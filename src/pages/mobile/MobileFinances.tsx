import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, Banknote, ShoppingCart, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateFromDB } from "@/lib/dateUtils";
import { calculateMonthlyDebtItems, getNetPaymentAmount } from "@/lib/creditAccounting";

interface Movement {
    id: number;
    type: string;
    category: string;
    amount: number;
    description: string;
    date: string;
}

export default function MobileFinances() {
    const { currentTenant } = useTenant();
    const { studentId } = useAuth();
    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(0);
    const [income, setIncome] = useState(0);
    const [expenses, setExpenses] = useState(0);
    const [monthlyDebt, setMonthlyDebt] = useState(0);
    const [paymentCount, setPaymentCount] = useState(0);

    useEffect(() => {
        if (currentTenant) {
            fetchData();
        }
    }, [currentTenant]);

    const fetchData = async () => {
        try {
            const isStudentView = !!studentId;
            const normalizedStudentId = typeof studentId === "string" && /^\d+$/.test(studentId)
                ? Number(studentId)
                : studentId;
            const tenantSettings = (currentTenant?.settings as any) || {};
            const configuredFee = Number(tenantSettings.monthly_fee);
            const monthlyFee = Number.isFinite(configuredFee) && configuredFee > 0 ? configuredFee : 3000;

            // 1. Fetch Income (Payments)
            let paymentsQuery = supabase
                .from("payments")
                .select("*")
                .eq("tenant_id", currentTenant?.id)
                .order("payment_date", { ascending: false })
                .limit(20);

            if (isStudentView) {
                paymentsQuery = paymentsQuery.eq("student_id", normalizedStudentId as any);
            }

            const { data: paymentsData, error: paymentsError } = await paymentsQuery;
            if (paymentsError) throw paymentsError;

            // 2. Fetch Expenses (solo vista admin/global)
            let expensesData: any[] = [];
            if (!isStudentView) {
                const { data, error: expensesError } = await supabase
                    .from("expenses")
                    .select("*")
                    .eq("tenant_id", currentTenant?.id)
                    .order("expense_date", { ascending: false })
                    .limit(20);

                if (expensesError) throw expensesError;
                expensesData = data || [];
            }

            // 3. Normalize and Merge
            const incomes: Movement[] = (paymentsData || []).map((p: any) => ({
                id: p.id,
                type: 'INCOME',
                category: 'Ingreso',
                amount: getNetPaymentAmount(p),
                description: p.concept,
                date: p.payment_date
            }));

            const outcomes: Movement[] = (expensesData || []).map((e: any) => ({
                id: e.id,
                type: 'EXPENSE',
                category: e.category || 'Gasto',
                amount: e.amount,
                description: e.description,
                date: e.expense_date
            }));

            const merged = [...incomes, ...outcomes].sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            setMovements(merged.slice(0, 20));
            setPaymentCount((paymentsData || []).length);

            // 4. Calculate Totals (Separate simple query for totals)
            let allPaymentsQuery = supabase
                .from("payments")
                .select("amount, concept")
                .eq("tenant_id", currentTenant?.id);

            if (isStudentView) {
                allPaymentsQuery = allPaymentsQuery.eq("student_id", normalizedStudentId as any);
            }

            const { data: allPayments } = await allPaymentsQuery;

            let allExpenses: any[] = [];
            if (!isStudentView) {
                const { data } = await supabase
                    .from("expenses")
                    .select("amount")
                    .eq("tenant_id", currentTenant?.id);
                allExpenses = data || [];
            }

            const totalInc = (allPayments || []).reduce((sum, p) => sum + getNetPaymentAmount(p), 0);
            const totalExp = (allExpenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

            setIncome(totalInc);
            setExpenses(totalExp);
            setBalance(totalInc - totalExp);

            if (isStudentView) {
                // Deuda estimada de cuotas para el año actual (marzo-diciembre)
                const { data: studentData } = await supabase
                    .from("students")
                    .select("enrollment_date")
                    .eq("tenant_id", currentTenant?.id)
                    .eq("id", normalizedStudentId as any)
                    .maybeSingle();

                if (studentData?.enrollment_date) {
                    const enrollmentDate = parseDateFromDB(studentData.enrollment_date);
                    const currentYear = new Date().getFullYear();
                    const enrollmentMonth = enrollmentDate.getMonth();
                    const enrollmentYear = enrollmentDate.getFullYear();
                    const startMonth = 2; // marzo
                    const firstPayableMonth = (enrollmentYear === currentYear && enrollmentMonth > startMonth)
                        ? enrollmentMonth
                        : startMonth;

                    const payableMonthsCount = Math.max(0, 12 - firstPayableMonth);
                    const applicationsResult = await supabase
                        .from("credit_applications")
                        .select("amount, reversed_amount, target_type, target_month")
                        .eq("tenant_id", currentTenant?.id)
                        .eq("student_id", normalizedStudentId as any)
                        .eq("target_type", "monthly_fee");

                    const monthItems = calculateMonthlyDebtItems({
                        enrollmentDate: studentData.enrollment_date,
                        monthlyFee,
                        payments: allPayments || [],
                        applications: applicationsResult.data || [],
                        period: "year",
                    });

                    setMonthlyDebt(monthItems.reduce((sum, item) => sum + item.due, 0));
                } else {
                    setMonthlyDebt(0);
                }
            } else {
                setMonthlyDebt(0);
            }

        } catch (err) {
            console.error("Error fetching finances:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2">
                <h1 className="text-2xl font-bold text-[#111418] dark:text-white">Finanzas</h1>
                <span className="text-xs text-gray-500 font-medium">{currentTenant?.name}</span>
            </div>

            {/* Summary Card (Glassmorphismish) */}
            <div className="w-full p-5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
                {/* Decoration Circles */}
                <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10 pointer-events-none"></div>

                <p className="text-blue-100 text-sm font-medium mb-1">Saldo Disponible</p>
                <h2 className="text-4xl font-bold tracking-tight mb-4">{formatCurrency(balance)}</h2>

                <div className="flex items-center gap-2 bg-white/20 w-fit px-3 py-1 rounded-lg backdrop-blur-sm">
                    <span className="text-xs font-semibold">
                        {studentId ? `${paymentCount} pagos registrados` : (balance >= 0 ? "Finanzas Saludables" : "Saldo Negativo")}
                    </span>
                </div>
            </div>

            {/* Income / Expense Row */}
            <div className="flex gap-3">
                <div className="flex-1 bg-white dark:bg-[#1c2630] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                            <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-gray-500 uppercase font-medium">Ingresos</span>
                    </div>
                    <p className="text-lg font-bold text-[#111418] dark:text-white">{formatCurrency(income)}</p>
                </div>
                <div className="flex-1 bg-white dark:bg-[#1c2630] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                            <ArrowUpRight className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-gray-500 uppercase font-medium">{studentId ? "Deuda Cuotas" : "Gastos"}</span>
                    </div>
                    <p className="text-lg font-bold text-[#111418] dark:text-white">{formatCurrency(studentId ? monthlyDebt : expenses)}</p>
                </div>
            </div>

            {/* Charts Section (Placeholder CSS Bars) */}
            <div className="bg-white dark:bg-[#1c2630] p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <p className="text-gray-500 text-sm font-medium">Flujo Mensual</p>
                        <p className="text-[#111418] dark:text-white text-xl font-bold">Resumen {new Date().getFullYear()}</p>
                    </div>
                </div>
                {/* CSS Only Chart (Mocked Visuals for now) */}
                <div className="grid grid-cols-6 gap-2 items-end h-[100px] w-full">
                    {/* Mock Bars */}
                    <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-sm h-[40%]"></div>
                    <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-sm h-[60%]"></div>
                    <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-sm h-[30%]"></div>
                    <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-sm h-[80%]"></div>
                    <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-sm h-[50%]"></div>
                    <div className="w-full bg-blue-600 rounded-t-sm h-[75%]"></div> {/* Active */}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>Jul</span><span>Ago</span><span>Sep</span><span>Oct</span><span>Nov</span><span className="font-bold text-blue-600">Dic</span>
                </div>
            </div>

            {/* Recent Transactions Header */}
            <div className="flex items-center justify-between pt-2">
                <h3 className="text-lg font-bold text-[#111418] dark:text-white">Historial Reciente</h3>
            </div>

            {/* Transactions List */}
            <div className="bg-white dark:bg-[#1c2630] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
                {movements.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No hay movimientos recientes</div>
                ) : (
                    movements.map((move) => (
                        <div key={move.id} className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className={`h-10 w-10 flex items-center justify-center rounded-full shrink-0 ${move.type === 'INCOME'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                }`}>
                                {move.type === 'INCOME' ? <Banknote className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                            </div>

                            <div className="flex flex-col flex-1 min-w-0">
                                <p className="text-[#111418] dark:text-white text-sm font-semibold truncate">{move.description || move.category}</p>
                                <p className="text-gray-500 text-xs truncate">{format(new Date(move.date), "d MMM, yyyy", { locale: es })}</p>
                            </div>

                            <div className="text-right shrink-0">
                                <p className={`text-sm font-bold ${move.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {move.type === 'INCOME' ? '+' : '-'}{formatCurrency(move.amount)}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

        </div>
    );
}
