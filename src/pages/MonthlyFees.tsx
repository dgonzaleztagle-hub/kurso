import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface MonthlyFeeStatus {
  student_id: number | null;
  student_name: string;
  total_required: number;
  total_paid: number;
  balance: number;
  percentage_paid: number;
}

const MONTHLY_FEE_AMOUNT = 3000;
const TOTAL_MONTHS = 10; // Marzo a Diciembre
const TOTAL_REQUIRED = MONTHLY_FEE_AMOUNT * TOTAL_MONTHS;

export default function MonthlyFees() {
  const [feeStatuses, setFeeStatuses] = useState<MonthlyFeeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    totalRequired: 0,
    totalPaid: 0,
    totalBalance: 0,
  });

  useEffect(() => {
    loadMonthlyFeeStatuses();
  }, []);

  const loadMonthlyFeeStatuses = async () => {
    try {
      // Get all students
      const [studentsResult, paymentsResult, creditMovementsResult] = await Promise.all([
        supabase.from("students").select("id, name").order("name"),
        supabase.from("payments").select("student_id, student_name, amount").or('concept.ilike.Cuota%,concept.ilike.CUOTA%'),
        supabase.from("credit_movements").select("student_id, amount, type").eq("type", "payment_redirect")
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const students = studentsResult.data || [];
      const payments = paymentsResult.data || [];
      const creditMovements = creditMovementsResult.data || [];

      // Group payments by student (by ID for accuracy)
      const paymentsByStudentId = new Map<number, number>();
      
      payments?.forEach((payment) => {
        if (payment.student_id) {
          const current = paymentsByStudentId.get(payment.student_id) || 0;
          paymentsByStudentId.set(payment.student_id, current + Number(payment.amount));
        }
      });

      // Add credit redirections (negative amounts = applied to monthly fees)
      creditMovements?.forEach((cm) => {
        if (cm.amount < 0) {
          const current = paymentsByStudentId.get(cm.student_id) || 0;
          paymentsByStudentId.set(cm.student_id, current + Math.abs(Number(cm.amount)));
        }
      });

      // Build fee status for each student
      const statuses: MonthlyFeeStatus[] = [];
      let totalRequired = 0;
      let totalPaid = 0;
      let totalBalance = 0;

      students?.forEach((student) => {
        const paid = paymentsByStudentId.get(student.id) || 0;
        const balance = TOTAL_REQUIRED - paid;
        const percentagePaid = (paid / TOTAL_REQUIRED) * 100;

        statuses.push({
          student_id: student.id,
          student_name: student.name,
          total_required: TOTAL_REQUIRED,
          total_paid: paid,
          balance: balance,
          percentage_paid: percentagePaid,
        });

        totalRequired += TOTAL_REQUIRED;
        totalPaid += paid;
        totalBalance += balance;
      });

      // Sort by name
      statuses.sort((a, b) => a.student_name.localeCompare(b.student_name));

      setFeeStatuses(statuses);
      setTotalStats({
        totalRequired,
        totalPaid,
        totalBalance,
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

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Estado de Cuotas Mensuales</h1>
        <p className="text-muted-foreground">
          Cuota mensual: ${MONTHLY_FEE_AMOUNT.toLocaleString()} | Meses: Marzo a Diciembre ({TOTAL_MONTHS} meses) | Total anual: ${TOTAL_REQUIRED.toLocaleString()}
        </p>
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
          <CardDescription>Detalle de cuotas mensuales por alumno</CardDescription>
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
