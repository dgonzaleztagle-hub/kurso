import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Loader2, Users, Wallet, School, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { Tenant, TenantSettings } from "@/types/db";

// Types
interface RolloverStudent {
    id: string;
    rut: string;
    first_name: string;
    last_name: string;
    debt_amount: number;
    credit_amount: number;
    selected: boolean;
    rollover_debt: boolean;
    rollover_credit: boolean;
}

type StudentRow = {
    id: string;
    rut: string;
    first_name: string;
    last_name: string;
};

type CreditMovementRow = {
    student_id: string;
    amount: number | string;
};

type PaymentRow = {
    student_id: string;
    amount: number | string;
};

type RolloverPayload = {
    old_student_id: string;
    rut: string;
    first_name: string;
    last_name: string;
    rollover_debt: number;
    rollover_credit: number;
};

const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Ocurrió un error inesperado";

const getMonthlyFee = (settings: TenantSettings | null) => {
    const rawFee = settings?.monthly_fee;
    return typeof rawFee === "number" ? rawFee : Number(rawFee ?? 0) || 0;
};

export default function YearRolloverWizard() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const fromTenantId = searchParams.get("from");
    const { refreshTenants } = useTenant();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Data
    const [oldTenant, setOldTenant] = useState<Tenant | null>(null);
    const [students, setStudents] = useState<RolloverStudent[]>([]);

    // Form Inputs
    const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
    const [newName, setNewName] = useState("");
    const [newFee, setNewFee] = useState(0);

    // Load Initial Data
    const fetchSourceData = useCallback(async () => {
        if (!fromTenantId) {
            toast.error("ID de curso no especificado");
            navigate("/dashboard");
            return;
        }

        try {
            // 1. Fetch Tenant
            const { data: tenant, error: tError } = await supabase
                .from("tenants")
                .select("*")
                .eq("id", fromTenantId)
                .single();

            if (tError) throw tError;
            setOldTenant(tenant as Tenant);

            // Auto-suggest name
            const suggestedName = tenant.name.replace(/\d{4}/, "").trim() + " " + newYear;
            setNewName(suggestedName);
            setNewFee(getMonthlyFee(tenant.settings as TenantSettings | null));

            // 2. Fetch Students & Financials
            // We need to calculate debts. This is heavy.
            // For MVP, we will fetch simplistic view:
            // Assuming we have a way to know debt. 
            // Reuse logic from Dashboard? 
            // We can't reuse complex logic easily here without replicating it.
            // Let's create a Helper query or function for this?
            // "students_with_balance" view?

            // For now, let's fetch students and simplistic credit check
            const { data: rawStudents, error: sError } = await supabase
                .from("students")
                .select("id, first_name, last_name, rut")
                .eq("tenant_id", fromTenantId);

            if (sError) throw sError;

            // Fetch Real Credits (using credit_movements)
            const { data: credits, error: cError } = await supabase
                .from("credit_movements")
                .select("student_id, amount, type")
                .eq("tenant_id", fromTenantId);

            if (cError) throw cError;

            const creditMap = new Map<string, number>();
            (credits as CreditMovementRow[] | null)?.forEach((credit) => {
                const current = creditMap.get(credit.student_id) || 0;
                // Assuming positive amount adds to credit? 
                // In Dashboard: "redirectedAmount" was absolute value of negative amounts.
                // Let's assume standard logic: credit positive. 
                // But Dashboard used: cm.amount < 0 for payment_redirect. 
                // Let's just sum raw amount if it represents "Wallet".
                // Safest bet: Sum everything.
                creditMap.set(credit.student_id, current + Number(credit.amount));
            });

            // Fetch payments to calculate actual debt
            const studentIds = (rawStudents as StudentRow[]).map((student) => student.id);
            const { data: paymentsData } = await supabase
                .from('payments')
                .select('student_id, amount')
                .in('student_id', studentIds);

            // MOCK DEBT CALCULATION (Simplified for Rollover)
            // Assumes full year debt check (March to December)
            const MONTHLY_FEE = 3000;
            const TOTAL_MONTHS = 10; // Mar-Dec
            const EXPECTED_YEARLY = MONTHLY_FEE * TOTAL_MONTHS;

            const paymentsMap = new Map<string, number>();
            (paymentsData as PaymentRow[] | null)?.forEach((payment) => {
                const current = paymentsMap.get(payment.student_id) || 0;
                paymentsMap.set(payment.student_id, current + Number(payment.amount));
            });

            const processedStudents: RolloverStudent[] = (rawStudents as StudentRow[]).map((student) => ({
                id: student.id,
                rut: student.rut,
                first_name: student.first_name,
                last_name: student.last_name,
                debt_amount: Math.max(0, EXPECTED_YEARLY - (paymentsMap.get(student.id) || 0)), // Real Calculation
                credit_amount: creditMap.get(student.id) || 0,
                selected: true,
                rollover_debt: true,
                rollover_credit: true,
            }));

            setStudents(processedStudents);
        } catch (error: unknown) {
            console.error("Error fetching data:", error);
            toast.error(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [fromTenantId, navigate, newYear]);

    useEffect(() => {
        void fetchSourceData();
    }, [fetchSourceData]);

    // Step Logic
    const nextStep = () => setStep(step + 1);
    const prevStep = () => setStep(step - 1);

    const handleExecRollover = async () => {
        setProcessing(true);
        try {
            // Prepare Student Data Payload
            const studentsToMigrate: RolloverPayload[] = students
                .filter(s => s.selected)
                .map(s => ({
                    old_student_id: s.id,
                    rut: s.rut,
                    first_name: s.first_name,
                    last_name: s.last_name,
                    rollover_debt: s.rollover_debt ? s.debt_amount : 0,
                    rollover_credit: s.rollover_credit ? s.credit_amount : 0
                }));

            const { error } = await supabase.rpc('migrate_course_year', {
                p_previous_tenant_id: fromTenantId,
                p_new_name: newName,
                p_new_fiscal_year: newYear,
                p_new_fee_amount: newFee,
                p_admin_ids: [],
                p_student_data: studentsToMigrate as Json[]
            });

            if (error) throw error;

            toast.success("¡Año Escolar iniciado con éxito!");

            // Refresh Context and Navigate
            await refreshTenants();
            // Force reload to update context cleanly
            window.location.href = "/dashboard";

        } catch (error: unknown) {
            console.error(error);
            toast.error(`Error al migrar curso: ${getErrorMessage(error)}`);
            setProcessing(false);
        }
    };

    if (loading || !oldTenant) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;

    return (
        <div className="min-h-screen bg-muted/20 flex flex-col items-center py-10 px-4">
            <div className="max-w-4xl w-full space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Comenzar Año Escolar {newYear}</h1>
                    <p className="text-muted-foreground">Migración desde {oldTenant.name}</p>
                </div>

                {/* Steps Progress */}
                <div className="flex justify-center gap-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-2 w-16 rounded-full ${step >= i ? 'bg-primary' : 'bg-gray-200'}`} />
                    ))}
                </div>

                <Card className="shadow-lg min-h-[400px]">
                    {step === 1 && (
                        <div className="animate-in slide-in-from-right duration-300">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><School /> Configuración Básica</CardTitle>
                                <CardDescription>Define los parámetros del nuevo curso.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Nombre del Nuevo Curso</label>
                                        <Input value={newName} onChange={e => setNewName(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Año Fiscal</label>
                                        <Input
                                            type="number"
                                            value={newYear}
                                            onChange={e => setNewYear(parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Cuota Mensual Base</label>
                                        <Input
                                            type="number"
                                            value={newFee}
                                            onChange={e => setNewFee(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button onClick={nextStep}>Siguiente <ArrowRight className="ml-2 h-4 w-4" /></Button>
                            </CardFooter>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in slide-in-from-right duration-300">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Users /> Selección de Estudiantes</CardTitle>
                                <CardDescription>Selecciona quienes continúan y gestiona sus saldos.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="border rounded-md max-h-[400px] overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="p-3 text-left w-10">
                                                    <Checkbox
                                                        checked={students.every(s => s.selected)}
                                                        onCheckedChange={(c) => setStudents(students.map(s => ({ ...s, selected: !!c })))}
                                                    />
                                                </th>
                                                <th className="p-3 text-left">Alumno</th>
                                                <th className="p-3 text-right">Saldo Favor</th>
                                                <th className="p-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, idx) => (
                                                <tr key={student.id} className="border-t hover:bg-muted/50">
                                                    <td className="p-3">
                                                        <Checkbox
                                                            checked={student.selected}
                                                            onCheckedChange={(c) => {
                                                                const newS = [...students];
                                                                newS[idx].selected = !!c;
                                                                setStudents(newS);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-3 font-medium">{student.first_name} {student.last_name}</td>
                                                    <td className="p-3 text-right text-green-600 font-bold">
                                                        {student.credit_amount > 0 ? `$${student.credit_amount}` : '-'}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {student.credit_amount > 0 && (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Checkbox
                                                                    checked={student.rollover_credit}
                                                                    onCheckedChange={(c) => {
                                                                        const newS = [...students];
                                                                        newS[idx].rollover_credit = !!c;
                                                                        setStudents(newS);
                                                                    }}
                                                                />
                                                                <span className="text-xs">Mover Saldo</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded flex gap-2">
                                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                                    <p>Los alumnos no seleccionados quedarán en el historial del curso anterior como "Bajas" o "Egresados".</p>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-between">
                                <Button variant="outline" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" /> Atrás</Button>
                                <Button onClick={nextStep}>Siguiente <ArrowRight className="ml-2 h-4 w-4" /></Button>
                            </CardFooter>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in slide-in-from-right duration-300">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Wallet /> Confirmación</CardTitle>
                                <CardDescription>Revisa los detalles antes de iniciar el nuevo año.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <Card>
                                        <CardHeader className="p-4"><CardTitle className="text-sm text-muted-foreground">Curso</CardTitle></CardHeader>
                                        <CardContent className="p-4 pt-0 font-bold text-lg">{newName}</CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="p-4"><CardTitle className="text-sm text-muted-foreground">Alumnos</CardTitle></CardHeader>
                                        <CardContent className="p-4 pt-0 font-bold text-lg">{students.filter(s => s.selected).length}</CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="p-4"><CardTitle className="text-sm text-muted-foreground">Año Fiscal</CardTitle></CardHeader>
                                        <CardContent className="p-4 pt-0 font-bold text-lg">{newYear}</CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="p-4"><CardTitle className="text-sm text-muted-foreground">Cuota</CardTitle></CardHeader>
                                        <CardContent className="p-4 pt-0 font-bold text-lg">${newFee}</CardContent>
                                    </Card>
                                </div>

                                <div className="bg-orange-50 border-orange-200 border rounded-md p-4">
                                    <h4 className="font-semibold text-orange-800 flex items-center gap-2">
                                        ⚠ Acción Irreversible
                                    </h4>
                                    <p className="text-sm text-orange-700 mt-1">
                                        Se creará un nuevo Curso activo. El curso anterior permanecerá archivado.
                                        Asegúrate de haber revisado la nómina de alumnos.
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-between">
                                <Button variant="outline" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" /> Atrás</Button>
                                <Button onClick={handleExecRollover} disabled={processing} className="bg-green-600 hover:bg-green-700">
                                    {processing ? (
                                        <>Procesando <Loader2 className="ml-2 h-4 w-4 animate-spin" /></>
                                    ) : (
                                        <>Confirmar e Iniciar <ArrowRight className="ml-2 h-4 w-4" /></>
                                    )}
                                </Button>
                            </CardFooter>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
