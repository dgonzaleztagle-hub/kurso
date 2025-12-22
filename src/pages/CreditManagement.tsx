import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDateForDB, formatDateForDisplay, parseDateFromDB } from "@/lib/dateUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRight, DollarSign, Info } from "lucide-react";
import { generateTransferReceipt } from "@/lib/receiptGenerator";

interface StudentWithCredit {
  id: number;
  name: string;
  credit_amount: number;
}

interface Payment {
  id: number;
  folio: number;
  payment_date: string;
  student_id: number | null;
  student_name: string | null;
  concept: string;
  amount: number;
  activity_id?: string;
}

interface Activity {
  id: number;
  name: string;
  amount: number;
}

interface MonthDebt {
  month: string;
  amount: number;
}

export default function CreditManagement() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [students, setStudents] = useState<StudentWithCredit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State
  const [showRedirectDialog, setShowRedirectDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [redirectType, setRedirectType] = useState<"credit" | "monthly_fees">("credit");
  const [availableActivities, setAvailableActivities] = useState<Activity[]>([]);
  const [availableMonths, setAvailableMonths] = useState<MonthDebt[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      loadData();
    }
  }, [currentTenant]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Students
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, first_name, last_name");

      if (studentsError) throw studentsError;

      // 2. Fetch Credit Movements (to calculate balances)
      const { data: movementsData, error: movementsError } = await supabase
        .from("credit_movements")
        .select("student_id, amount");

      if (movementsError) throw movementsError;

      // Calculate credit per student
      const creditMap = new Map<number, number>();
      movementsData?.forEach(m => {
        const current = creditMap.get(m.student_id) || 0;
        creditMap.set(m.student_id, current + Number(m.amount));
      });

      const studentsWithCredit = (studentsData || []).map(s => ({
        id: s.id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Sin Nombre',
        credit_amount: creditMap.get(s.id) || 0
      }));

      setStudents(studentsWithCredit);

      // 3. Fetch Payments (potential source for redirection)
      // Logic: Recent payments that might need redirection (e.g. activity payments)
      // For now, fetch latest 50 payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false })
        .limit(50);

      if (paymentsError) throw paymentsError;

      setPayments((paymentsData || []).map(p => ({
        id: p.id,
        folio: p.folio,
        payment_date: p.payment_date,
        student_id: p.student_id,
        student_name: p.student_name,
        concept: p.concept,
        amount: p.amount,
        activity_id: p.activity_id
      })));

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const openRedirectDialog = async (payment: Payment) => {
    setSelectedPayment(payment);
    setRedirectType("credit"); // Default
    setSelectedActivities([]);
    setSelectedMonths([]);

    // Simulate fetching debts for this student if needed
    // For now we mock or leave empty as implemented in previous logic
    if (payment.student_id) {
      // Fetch real debts here if API supports it
      // setAvailableActivities(...)
      // setAvailableMonths(...)
    }

    setShowRedirectDialog(true);
  };

  const handleRedirect = async () => {
    if (!selectedPayment || !selectedPayment.student_id) return;

    setProcessing(true);
    try {
      // Create credit movement
      const { error } = await supabase.from("credit_movements").insert({
        tenant_id: currentTenant?.id,
        student_id: selectedPayment.student_id,
        amount: selectedPayment.amount,
        type: 'payment_redirect',
        description: `Redirección de pago folio #${selectedPayment.folio}: ${selectedPayment.concept}`,
        source_payment_id: selectedPayment.id
      });

      if (error) throw error;

      toast.success("Pago redirigido a crédito exitosamente");
      setShowRedirectDialog(false);
      loadData(); // Refresh to show new credit
    } catch (error) {
      console.error("Error redirecting payment:", error);
      toast.error("Error al redirigir pago");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestión de Créditos</h1>
      </div>

      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-3 text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold">¿Cómo funciona el sistema de créditos?</p>
              <p>
                Si un estudiante pagó una actividad (ej. "Entrada a Fantasilandia") y no pudo asistir,
                ese dinero no se considera gastado. Existen 2 opciones para gestionar este monto:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-1">
                <li>
                  <span className="font-semibold">Opción A (Traspaso Interno):</span> Se realiza un traspaso para cubrir
                  otras deudas pendientes del mismo estudiante (Cuotas mensuales o Actividades).
                  Si sobra dinero, este excedente queda como <strong>Crédito a Favor</strong> para futuras actividades.
                  <em>Este traspaso no afecta el saldo bancario real.</em>
                </li>
                <li>
                  <span className="font-semibold">Opción B (Devolución):</span> Si el alumno no tiene deudas,
                  se puede solicitar la devolución del dinero. De lo contrario, permanecerá como un excedente o crédito en el sistema.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de Créditos */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Créditos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(students.reduce((sum, s) => sum + s.credit_amount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {students.filter(s => s.credit_amount > 0).length} estudiantes con crédito
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Pagos de Actividades */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Actividad/Concepto</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.folio}</TableCell>
                    <TableCell>{formatDateForDisplay(payment.payment_date)}</TableCell>
                    <TableCell>{payment.student_name || "N/A"}</TableCell>
                    <TableCell>{payment.concept}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRedirectDialog(payment)}
                      >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Redirigir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Redirección */}
      <Dialog open={showRedirectDialog} onOpenChange={setShowRedirectDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redirigir Pago</DialogTitle>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Estudiante:</strong> {selectedPayment.student_name}
                </p>
                <p className="text-sm">
                  <strong>Actividad:</strong> {selectedPayment.concept}
                </p>
                <p className="text-sm">
                  <strong>Monto:</strong> {formatCurrency(selectedPayment.amount)}
                </p>
              </div>

              <div>
                <Label>Aplicar a cuotas o actividades</Label>
                <Select value={redirectType} onValueChange={(value: any) => setRedirectType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Dejar como crédito</SelectItem>
                    <SelectItem value="monthly_fees">Aplicar a otras deudas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {redirectType === "monthly_fees" && (
                <div className="space-y-3">
                  {/* Logic for debt application selection would go here */}
                  <p className="text-sm text-muted-foreground p-2 border rounded">
                    Funcionalidad de aplicación directa a deudas en desarrollo.
                    Por el momento, se recomienda dejar como crédito y luego registrar el pago de la deuda usando el saldo a favor.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedirectDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRedirect} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Redirección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
