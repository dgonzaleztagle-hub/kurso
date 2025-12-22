import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { parseDateFromDB } from "@/lib/dateUtils";

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  enrollment_date: string;
}

interface Activity {
  id: number;
  name: string;
  amount: number;
}

interface PaymentStatus {
  student_id: number;
  student_name: string;
  activity_id: number;
  activity_name: string;
  activity_amount: number;
  total_paid: number;
  is_excluded: boolean;
  was_not_enrolled: boolean;
}

export default function ActivityPayments() {
  const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentStatuses();
  }, []);

  const loadPaymentStatuses = async () => {
    try {
      // Get all students with enrollment dates
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, first_name, last_name, enrollment_date")
        .order("last_name");

      if (studentsError) throw studentsError;

      // Get all activities with dates
      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select("id, name, amount, activity_date");

      if (activitiesError) throw activitiesError;

      // Get all exclusions
      const { data: exclusions, error: exclusionsError } = await supabase
        .from("activity_exclusions")
        .select("student_id, activity_id");

      if (exclusionsError) throw exclusionsError;

      // Get all payments (we'll match by concept name)
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("student_id, concept, amount");

      if (paymentsError) throw paymentsError;

      // Create a map of exclusions
      const exclusionMap = new Set(
        exclusions?.map((e) => `${e.student_id}-${e.activity_id}`) || []
      );

      // Create a map of payments by student and activity (matching by concept name)
      const paymentMap = new Map<string, number>();
      payments?.forEach((payment) => {
        // Find matching activity by concept name
        const matchingActivity = activities?.find(
          (act) => payment.concept?.toUpperCase().includes(act.name.toUpperCase())
        );

        if (matchingActivity && payment.student_id) {
          const key = `${payment.student_id}-${matchingActivity.id}`;
          const current = paymentMap.get(key) || 0;
          paymentMap.set(key, current + Number(payment.amount));
        }
      });

      // Build the payment status array
      const statuses: PaymentStatus[] = [];
      students?.forEach((student) => {
        const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Sin Nombre';

        activities?.forEach((activity) => {
          const key = `${student.id}-${activity.id}`;
          const isExcluded = exclusionMap.has(key);
          const totalPaid = paymentMap.get(key) || 0;

          // Check if student was enrolled at the time of the activity
          const wasNotEnrolled = activity.activity_date &&
            student.enrollment_date &&
            parseDateFromDB(student.enrollment_date) > parseDateFromDB(activity.activity_date);

          statuses.push({
            student_id: student.id,
            student_name: studentName,
            activity_id: activity.id,
            activity_name: activity.name,
            activity_amount: activity.amount,
            total_paid: totalPaid,
            is_excluded: isExcluded,
            was_not_enrolled: wasNotEnrolled || false,
          });
        });
      });

      setPaymentStatuses(statuses);
    } catch (error) {
      console.error("Error loading payment statuses:", error);
      toast.error("Error al cargar estado de pagos");
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatus = (status: PaymentStatus) => {
    if (status.was_not_enrolled) {
      return <Badge variant="outline" className="bg-muted">No matriculado aún</Badge>;
    }

    if (status.is_excluded) {
      return <Badge variant="outline">Excluido</Badge>;
    }

    const remaining = status.activity_amount - status.total_paid;

    if (remaining <= 0) {
      return <Badge className="bg-green-500">Pagado</Badge>;
    } else if (status.total_paid > 0) {
      return <Badge variant="secondary">Parcial (${remaining.toLocaleString()} restante)</Badge>;
    } else {
      return <Badge variant="destructive">Pendiente</Badge>;
    }
  };

  // Group by activity
  const groupedByActivity = paymentStatuses.reduce((acc, status) => {
    if (!acc[status.activity_name]) {
      acc[status.activity_name] = [];
    }
    acc[status.activity_name].push(status);
    return acc;
  }, {} as Record<string, PaymentStatus[]>);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Estado de Pagos por Actividad</h1>
        <p className="text-muted-foreground">
          Visualice el estado de pago de cada estudiante por actividad
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">Cargando estado de pagos...</div>
      ) : Object.keys(groupedByActivity).length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No hay datos para mostrar
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByActivity).map(([activityName, statuses]) => (
            <Card key={activityName}>
              <CardHeader>
                <CardTitle>{activityName}</CardTitle>
                <CardDescription className="space-y-1">
                  <div>Monto por estudiante: ${statuses[0]?.activity_amount.toLocaleString()}</div>
                  <div className="text-sm">
                    {(() => {
                      const nonExcluded = statuses.filter(s => !s.is_excluded && !s.was_not_enrolled);
                      const totalExpected = nonExcluded.length * statuses[0]?.activity_amount;
                      const totalCollected = nonExcluded.reduce((sum, s) => sum + s.total_paid, 0);
                      const totalOutstanding = totalExpected - totalCollected;

                      return (
                        <>
                          <span className="font-semibold">Total esperado:</span> ${totalExpected.toLocaleString()} |
                          <span className="font-semibold ml-2">Recaudado:</span> ${totalCollected.toLocaleString()} |
                          <span className="font-semibold ml-2">Adeudado:</span> ${totalOutstanding.toLocaleString()}
                        </>
                      );
                    })()}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Pagado</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statuses.map((status) => (
                      <TableRow key={`${status.student_id}-${status.activity_id}`}>
                        <TableCell className="font-medium">
                          {status.student_name}
                        </TableCell>
                        <TableCell>
                          {status.was_not_enrolled
                            ? "-"
                            : status.is_excluded
                              ? "-"
                              : `$${status.total_paid.toLocaleString()}`}
                        </TableCell>
                        <TableCell>{getPaymentStatus(status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
