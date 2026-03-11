import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Save, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { calculateMonthlyDebtItems } from "@/lib/creditAccounting";

interface MonthlyFeeStatus {
  student_id: string | null;
  student_name: string;
  total_required: number;
  total_paid: number;
  balance: number;
  percentage_paid: number;
}

const DEFAULT_FEE = 3000;
const TOTAL_MONTHS = 10; // Marzo a Diciembre

export default function MonthlyFees() {
  const { currentTenant, refreshTenants } = useTenant();
  const { appUser } = useAuth();

  // State
  const [feeStatuses, setFeeStatuses] = useState<MonthlyFeeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFee, setCurrentFee] = useState(DEFAULT_FEE);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const [totalStats, setTotalStats] = useState({
    totalRequired: 0,
    totalPaid: 0,
    totalBalance: 0,
  });

  // Calculate annual total based on dynamic fee
  const annualTotal = currentFee * TOTAL_MONTHS;

  useEffect(() => {
    if (currentTenant) {
      // Load fee from settings or default
      const settings = currentTenant.settings as any;
      const savedFee = settings?.monthly_fee ? Number(settings.monthly_fee) : DEFAULT_FEE;
      setCurrentFee(savedFee);
      loadMonthlyFeeStatuses(savedFee);
    }
  }, [currentTenant]);

  const handleEditClick = () => {
    setEditValue(String(currentFee));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitir números
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setEditValue(val);
    }
  };

  const handleSaveFee = async () => {
    if (!currentTenant) return;

    // Si está vacío, asumir 0
    const valParam = editValue === "" ? "0" : editValue;
    const newFee = parseInt(valParam);

    if (isNaN(newFee) || newFee < 0) {
      toast.error("Por favor ingrese un monto válido");
      return;
    }

    try {
      const currentSettings = (currentTenant.settings as any) || {};
      const updatedSettings = {
        ...currentSettings,
        monthly_fee: newFee
      };

      const { data: updatedTenant, error } = await supabase
        .from('tenants')
        .update({ settings: updatedSettings })
        .eq('id', currentTenant.id)
        .select('settings');

      if (error) throw error;
      if (!updatedTenant || (Array.isArray(updatedTenant) && updatedTenant.length === 0)) {
        throw new Error("La cuota no se pudo persistir en la base de datos");
      }

      toast.success("Monto de cuota actualizado");
      const persistedFee = Number(((updatedTenant as any)?.[0]?.settings || updatedSettings).monthly_fee);
      setCurrentFee(Number.isFinite(persistedFee) ? persistedFee : newFee);
      setIsEditing(false);
      loadMonthlyFeeStatuses(Number.isFinite(persistedFee) ? persistedFee : newFee); // Reload with new fee
      await refreshTenants(currentTenant.id);
    } catch (error) {
      console.error("Error updating fee:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const loadMonthlyFeeStatuses = async (feeAmount: number) => {
    try {
      setLoading(true);
      if (!currentTenant?.id) return;
      // Recalculate based on the passed feeAmount
      const calculatedTotalRequired = feeAmount * TOTAL_MONTHS;

      // Get all students
      const [studentsResult, paymentsResult, applicationsResult] = await Promise.all([
        supabase.from("students").select("id, first_name, last_name, enrollment_date").eq("tenant_id", currentTenant.id).order("last_name"),
        supabase.from("payments").select("student_id, amount, concept, redirected_amount, month_period").eq("tenant_id", currentTenant.id),
        supabase.from("credit_applications").select("student_id, amount, reversed_amount, target_type, target_month").eq("tenant_id", currentTenant.id).eq("target_type", "monthly_fee")
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (applicationsResult.error) throw applicationsResult.error;

      const students = studentsResult.data || [];
      const payments = paymentsResult.data || [];
      const applications = applicationsResult.data || [];

      // Build fee status for each student
      const statuses: MonthlyFeeStatus[] = [];
      let totalRequiredSum = 0;
      let totalPaidSum = 0;
      let totalBalanceSum = 0;

      students?.forEach((student) => {
        const studentPayments = payments.filter((payment) => payment.student_id === student.id);
        const studentApplications = applications.filter((application) => application.student_id === student.id);
        const monthItems = calculateMonthlyDebtItems({
          enrollmentDate: student.enrollment_date,
          monthlyFee: feeAmount,
          payments: studentPayments,
          applications: studentApplications,
          year: new Date().getFullYear(),
          period: "year",
        });
        const balance = monthItems.reduce((sum, item) => sum + item.due, 0);
        const paid = Math.max(0, calculatedTotalRequired - balance);
        const percentagePaid = (paid / calculatedTotalRequired) * 100;

        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Sin Nombre';

        statuses.push({
          student_id: student.id,
          student_name: fullName,
          total_required: calculatedTotalRequired,
          total_paid: paid,
          balance: balance,
          percentage_paid: isFinite(percentagePaid) ? percentagePaid : 0,
        });

        totalRequiredSum += calculatedTotalRequired;
        totalPaidSum += paid;
        totalBalanceSum += balance;
      });

      // Sort by name
      statuses.sort((a, b) => a.student_name.localeCompare(b.student_name));

      setFeeStatuses(statuses);
      setTotalStats({
        totalRequired: totalRequiredSum,
        totalPaid: totalPaidSum,
        totalBalance: totalBalanceSum,
      });
    } catch (error) {
      console.error("Error loading monthly fee statuses:", error);
      toast.error("Error al cargar estado de cuotas");
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatus = (status: MonthlyFeeStatus) => {
    if (status.balance <= 0) {
      return <Badge className="bg-green-500">Al día</Badge>;
    } else if (status.total_paid > 0) {
      return <Badge variant="secondary">Deuda parcial</Badge>;
    } else {
      return <Badge variant="destructive">Sin pago</Badge>;
    }
  };

  const canEdit = appUser?.is_superadmin || currentTenant?.owner_id === appUser?.id;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Estado de Cuotas Mensuales</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Cuota mensual:</span>

            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={editValue}
                  onChange={handleInputChange}
                  className="w-32 h-8"
                  placeholder="0"
                  inputMode="numeric"
                />
                <Button size="sm" onClick={handleSaveFee} className="h-8 w-8 p-0" variant="default">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handleCancelEdit} className="h-8 w-8 p-0" variant="ghost">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">${currentFee.toLocaleString()}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-transparent"
                    onClick={handleEditClick}
                    title="Editar monto"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors" />
                  </Button>
                )}
              </div>
            )}

            <span>| Meses: Marzo a Diciembre ({TOTAL_MONTHS}) | Total anual: ${annualTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total a Recaudar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalStats.totalRequired.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pagado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalStats.totalPaid.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalStats.totalBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado por Estudiante</CardTitle>
          <CardDescription>Detalle de cuotas mensuales por alumno (Calculado con base cuota: ${currentFee})</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando estado de cuotas...</div>
          ) : feeStatuses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay datos para mostrar
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Total Pagado</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeStatuses.map((status, index) => (
                  <TableRow key={`${status.student_id}-${index}`}>
                    <TableCell className="font-medium">
                      {status.student_name}
                    </TableCell>
                    <TableCell className="text-green-600">
                      ${status.total_paid.toLocaleString()}
                    </TableCell>
                    <TableCell className={status.balance > 0 ? "text-red-600" : "text-green-600"}>
                      ${Math.abs(status.balance).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(status.percentage_paid, 100)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          {Math.round(status.percentage_paid)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getPaymentStatus(status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
