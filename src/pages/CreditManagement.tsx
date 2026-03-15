import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowRight, DollarSign, Info } from "lucide-react";
import { toast } from "sonner";
import { formatDateForDisplay, parseDateFromDB } from "@/lib/dateUtils";
import {
  calculateMonthlyDebtItems,
  getAppliedCreditForActivity,
  getCurrentSchoolYear,
  getNetPaymentAmount,
  sameId,
  toSafeNumber,
} from "@/lib/creditAccounting";

interface StudentWithCredit {
  id: string;
  name: string;
  credit_amount: number;
}

interface Payment {
  id: string;
  folio: number | string;
  payment_date: string;
  student_id: string | null;
  student_name: string | null;
  concept: string;
  amount: number;
  activity_id: string | null;
  redirected_amount: number;
  redirect_status: string;
  redirect_locked: boolean;
}

interface ActivityDebtOption {
  type: "activity";
  id: string;
  label: string;
  due: number;
  sortDate: string;
  targetActivityId: string;
}

interface MonthlyDebtOption {
  type: "monthly_fee";
  id: string;
  label: string;
  due: number;
  sortDate: string;
  targetMonth: string;
}

type DebtOption = ActivityDebtOption | MonthlyDebtOption;

const DEFAULT_MONTHLY_FEE = 3000;

type StudentRow = Pick<Tables<"students">, "id" | "first_name" | "last_name">;
type CreditRow = Pick<Tables<"student_credits">, "student_id" | "amount">;
type PaymentRow = Pick<Tables<"payments">, "id" | "folio" | "payment_date" | "student_id" | "student_name" | "concept" | "amount" | "activity_id" | "redirected_amount" | "redirect_status" | "redirect_locked">;
type StudentDebtRow = Pick<Tables<"students">, "id" | "enrollment_date">;
type DebtPaymentRow = Pick<Tables<"payments">, "amount" | "redirected_amount" | "concept" | "activity_id" | "month_period">;
type ActivityRow = Pick<Tables<"activities">, "id" | "name" | "amount" | "activity_date">;
type ExclusionRow = Pick<Tables<"activity_exclusions">, "activity_id">;
type CreditApplicationRow = Pick<Tables<"credit_applications">, "amount" | "reversed_amount" | "target_type" | "target_month" | "target_activity_id">;

export default function CreditManagement() {
  const { appUser } = useAuth();
  const { currentTenant } = useTenant();
  const [students, setStudents] = useState<StudentWithCredit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRedirectDialog, setShowRedirectDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [redirectAmount, setRedirectAmount] = useState("");
  const [redirectNotes, setRedirectNotes] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithCredit | null>(null);
  const [studentDebtOptions, setStudentDebtOptions] = useState<DebtOption[]>([]);
  const [selectedDebtOptionId, setSelectedDebtOptionId] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [applyNotes, setApplyNotes] = useState("");
  const [loadingDebts, setLoadingDebts] = useState(false);
  const [applying, setApplying] = useState(false);

  const monthlyFee = useMemo(() => {
    const configured = Number(currentTenant?.settings?.monthly_fee);
    return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_MONTHLY_FEE;
  }, [currentTenant?.settings]);

  const loadData = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      setLoading(true);

      const [studentsResult, creditsResult, paymentsResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, last_name")
          .eq("tenant_id", currentTenant.id)
          .order("last_name"),
        supabase
          .from("student_credits")
          .select("student_id, amount")
          .eq("tenant_id", currentTenant.id),
        supabase
          .from("payments")
          .select("id, folio, payment_date, student_id, student_name, concept, amount, activity_id, redirected_amount, redirect_status, redirect_locked")
          .eq("tenant_id", currentTenant.id)
          .not("student_id", "is", null)
          .order("payment_date", { ascending: false })
          .limit(100),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (creditsResult.error) throw creditsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const creditMap = new Map<string, number>();
      ((creditsResult.data as CreditRow[] | null) || []).forEach((credit) => {
        creditMap.set(String(credit.student_id), toSafeNumber(credit.amount));
      });

      setStudents(
        (((studentsResult.data as StudentRow[] | null) || []).map((student) => ({
          id: String(student.id),
          name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin Nombre",
          credit_amount: creditMap.get(String(student.id)) || 0,
        }))),
      );

      setPayments(
        (((paymentsResult.data as PaymentRow[] | null) || []).map((payment) => ({
          ...payment,
          student_id: payment.student_id === null ? null : String(payment.student_id),
          activity_id: payment.activity_id === null ? null : String(payment.activity_id),
          redirected_amount: toSafeNumber(payment.redirected_amount),
          redirect_status: payment.redirect_status || "available",
          redirect_locked: !!payment.redirect_locked,
        }))),
      );
    } catch (error: unknown) {
      console.error("Error loading credit data:", error);
      toast.error("Error al cargar datos de créditos");
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    if (currentTenant?.id) {
      void loadData();
    }
  }, [currentTenant?.id, loadData]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const canRedirectPayment = (payment: Payment) =>
    !!payment.student_id && !payment.redirect_locked && toSafeNumber(payment.redirected_amount) <= 0;

  const openRedirectDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setRedirectAmount(String(payment.amount));
    setRedirectNotes("");
    setShowRedirectDialog(true);
  };

  const handleRedirect = async () => {
    if (!selectedPayment) return;

    const amount = toSafeNumber(redirectAmount);
    if (amount <= 0) {
      toast.error("Debe indicar un monto válido");
      return;
    }

    if (amount > selectedPayment.amount) {
      toast.error("El monto no puede exceder el pago original");
      return;
    }

    try {
      setRedirecting(true);
      const { error } = await supabase.rpc("redirect_payment_to_credit", {
        p_payment_id: selectedPayment.id,
        p_amount: amount,
        p_notes: redirectNotes.trim() || null,
      });

      if (error) throw error;

      toast.success("Crédito generado y pago bloqueado para nuevas redirecciones");
      setShowRedirectDialog(false);
      await loadData();
    } catch (error: unknown) {
      console.error("Error redirecting payment:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo redirigir el pago");
    } finally {
      setRedirecting(false);
    }
  };

  const loadDebtOptionsForStudent = async (student: StudentWithCredit) => {
    if (!currentTenant?.id) return;

    try {
      setLoadingDebts(true);

      const [studentResult, paymentsResult, activitiesResult, exclusionsResult, applicationsResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, enrollment_date")
          .eq("tenant_id", currentTenant.id)
          .eq("id", student.id)
          .single(),
        supabase
          .from("payments")
          .select("amount, redirected_amount, concept, activity_id, month_period")
          .eq("tenant_id", currentTenant.id)
          .eq("student_id", student.id),
        supabase
          .from("activities")
          .select("id, name, amount, activity_date")
          .eq("tenant_id", currentTenant.id)
          .order("activity_date"),
        supabase
          .from("activity_exclusions")
          .select("activity_id")
          .eq("tenant_id", currentTenant.id)
          .eq("student_id", student.id),
        supabase
          .from("credit_applications")
          .select("amount, reversed_amount, target_type, target_month, target_activity_id")
          .eq("tenant_id", currentTenant.id)
          .eq("student_id", student.id),
      ]);

      if (studentResult.error) throw studentResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (exclusionsResult.error) throw exclusionsResult.error;
      if (applicationsResult.error) throw applicationsResult.error;

      const enrollmentDate = studentResult.data.enrollment_date;
      const paymentsData = (paymentsResult.data as DebtPaymentRow[] | null) || [];
      const activitiesData = (activitiesResult.data as ActivityRow[] | null) || [];
      const exclusionsData = (exclusionsResult.data as ExclusionRow[] | null) || [];
      const applicationsData = (applicationsResult.data as CreditApplicationRow[] | null) || [];

      const monthlyDebtOptions = calculateMonthlyDebtItems({
        enrollmentDate,
        monthlyFee,
        payments: paymentsData,
        applications: applicationsData,
        year: getCurrentSchoolYear(),
        period: "year",
      })
        .filter((month) => month.due > 0)
        .map<MonthlyDebtOption>((month) => ({
          type: "monthly_fee",
          id: `monthly:${month.key}`,
          label: `Cuota ${month.label}`,
          due: month.due,
          sortDate: `${getCurrentSchoolYear()}-${String(month.sortOrder + 1).padStart(2, "0")}-01`,
          targetMonth: month.key,
        }));

      const exclusions = new Set(exclusionsData.map((item) => item.activity_id));
      const studentEnrollment = parseDateFromDB(enrollmentDate);
      const activityDebtOptions = activitiesData
        .filter((activity) => {
          if (!activity.activity_date) return false;
          if (exclusions.has(activity.id)) return false;
          const activityDate = parseDateFromDB(activity.activity_date);
          return studentEnrollment <= activityDate;
        })
        .map<ActivityDebtOption | null>((activity) => {
          const directPaid = paymentsData
            .filter((payment) => {
              if (sameId(payment.activity_id, activity.id)) return true;
              return String(payment.concept || "").toUpperCase().includes(activity.name.toUpperCase());
            })
            .reduce((sum, payment) => sum + getNetPaymentAmount(payment), 0);

          const appliedCredit = getAppliedCreditForActivity(applicationsData, activity.id);
          const due = Math.max(0, toSafeNumber(activity.amount) - directPaid - appliedCredit);

          if (due <= 0) return null;

          return {
            type: "activity",
            id: `activity:${activity.id}`,
            label: `Actividad ${activity.name}`,
            due,
            sortDate: activity.activity_date || `${getCurrentSchoolYear()}-12-31`,
            targetActivityId: activity.id,
          };
        })
        .filter(Boolean) as ActivityDebtOption[];

      const allOptions = [...monthlyDebtOptions, ...activityDebtOptions].sort((a, b) =>
        a.sortDate.localeCompare(b.sortDate),
      );

      setStudentDebtOptions(allOptions);
      setSelectedDebtOptionId(allOptions[0]?.id || "");
      setApplyAmount(allOptions[0] ? String(allOptions[0].due) : "");
    } catch (error: unknown) {
      console.error("Error loading student debts:", error);
      toast.error("No se pudieron cargar las deudas del alumno");
      setStudentDebtOptions([]);
      setSelectedDebtOptionId("");
      setApplyAmount("");
    } finally {
      setLoadingDebts(false);
    }
  };

  const openApplyDialog = async (student: StudentWithCredit) => {
    setSelectedStudent(student);
    setApplyNotes("");
    setShowApplyDialog(true);
    await loadDebtOptionsForStudent(student);
  };

  const selectedDebtOption = studentDebtOptions.find((option) => option.id === selectedDebtOptionId) || null;

  const handleApplyCredit = async () => {
    if (!selectedStudent || !selectedDebtOption) return;

    const amount = toSafeNumber(applyAmount);
    if (amount <= 0) {
      toast.error("Debe indicar un monto válido");
      return;
    }

    if (amount > selectedStudent.credit_amount) {
      toast.error("El monto excede el crédito disponible del alumno");
      return;
    }

    if (amount > selectedDebtOption.due) {
      toast.error("El monto excede la deuda seleccionada");
      return;
    }

    try {
      setApplying(true);
      const { error } = await supabase.rpc("apply_credit_manually", {
        p_student_id: selectedStudent.id,
        p_target_type: selectedDebtOption.type,
        p_target_month: selectedDebtOption.type === "monthly_fee" ? selectedDebtOption.targetMonth : null,
        p_target_activity_id: selectedDebtOption.type === "activity" ? selectedDebtOption.targetActivityId : null,
        p_amount: amount,
        p_notes: applyNotes.trim() || null,
      });

      if (error) throw error;

      toast.success("Crédito aplicado manualmente");
      setShowApplyDialog(false);
      await loadData();
    } catch (error: unknown) {
      console.error("Error applying credit:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar el crédito");
    } finally {
      setApplying(false);
    }
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
            <div className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold">Libro mayor de créditos</p>
              <p>
                Un pago redirigido genera crédito auditable, queda bloqueado para nuevas redirecciones y su monto
                redirigido deja de contar como pago neto. El crédito se aplica manualmente a meses específicos o a
                actividades puntuales.
              </p>
              <p>
                Las reversas quedan reservadas para superadmin en el historial de movimientos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Créditos Disponibles</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(students.reduce((sum, student) => sum + student.credit_amount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {students.filter((student) => student.credit_amount > 0).length} estudiantes con saldo a favor
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">Pagos redirigibles</TabsTrigger>
          <TabsTrigger value="credits">Aplicar crédito</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Pagos recientes</CardTitle>
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
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Redirigido</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => {
                      const netAmount = getNetPaymentAmount(payment);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>{payment.folio}</TableCell>
                          <TableCell>{formatDateForDisplay(payment.payment_date)}</TableCell>
                          <TableCell>{payment.student_name || "Sin alumno"}</TableCell>
                          <TableCell>{payment.concept}</TableCell>
                          <TableCell className="text-right">{formatCurrency(netAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(payment.redirected_amount)}</TableCell>
                          <TableCell>
                            <Badge variant={payment.redirect_locked ? "secondary" : "default"}>
                              {payment.redirect_status === "fully_redirected"
                                ? "Totalmente redirigido"
                                : payment.redirect_status === "partially_redirected"
                                  ? "Parcialmente redirigido"
                                  : "Disponible"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRedirectDialog(payment)}
                              disabled={!canRedirectPayment(payment)}
                            >
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Redirigir
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits">
          <Card>
            <CardHeader>
              <CardTitle>Crédito disponible por alumno</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Cargando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead className="text-right">Crédito disponible</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students
                      .filter((student) => student.credit_amount > 0)
                      .map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>{student.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(student.credit_amount)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => void openApplyDialog(student)}>
                              Aplicar crédito
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showRedirectDialog} onOpenChange={setShowRedirectDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Redirigir pago a crédito</DialogTitle>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>Estudiante:</strong> {selectedPayment.student_name}</p>
                <p><strong>Concepto:</strong> {selectedPayment.concept}</p>
                <p><strong>Monto original:</strong> {formatCurrency(selectedPayment.amount)}</p>
                <p><strong>Monto neto actual:</strong> {formatCurrency(getNetPaymentAmount(selectedPayment))}</p>
              </div>

              <div className="space-y-2">
                <Label>Monto a redirigir</Label>
                <Input
                  inputMode="numeric"
                  value={redirectAmount}
                  onChange={(event) => setRedirectAmount(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Puede redirigir total o parcialmente el pago, pero solo una vez.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Glosa</Label>
                <Textarea
                  value={redirectNotes}
                  onChange={(event) => setRedirectNotes(event.target.value)}
                  placeholder="Motivo del crédito o contexto contable"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedirectDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRedirect()} disabled={redirecting}>
              {redirecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar redirección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Aplicar crédito manualmente</DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>Alumno:</strong> {selectedStudent.name}</p>
                <p><strong>Crédito disponible:</strong> {formatCurrency(selectedStudent.credit_amount)}</p>
              </div>

              {loadingDebts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando deudas...
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Deuda destino</Label>
                    <Select
                      value={selectedDebtOptionId}
                      onValueChange={(value) => {
                        setSelectedDebtOptionId(value);
                        const option = studentDebtOptions.find((item) => item.id === value);
                        if (option) setApplyAmount(String(option.due));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione la deuda a cubrir" />
                      </SelectTrigger>
                      <SelectContent>
                        {studentDebtOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label} - {formatCurrency(option.due)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedDebtOption && (
                    <div className="text-xs text-muted-foreground">
                      Deuda seleccionada: {selectedDebtOption.label}. Monto pendiente {formatCurrency(selectedDebtOption.due)}.
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Monto a aplicar</Label>
                    <Input
                      inputMode="numeric"
                      value={applyAmount}
                      onChange={(event) => setApplyAmount(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Glosa</Label>
                    <Textarea
                      value={applyNotes}
                      onChange={(event) => setApplyNotes(event.target.value)}
                      placeholder="Referencia de aplicación manual"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleApplyCredit()}
              disabled={applying || loadingDebts || !selectedDebtOption}
            >
              {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aplicar crédito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
