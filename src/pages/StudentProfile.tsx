import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { DollarSign, AlertCircle, Calendar, FileText, ChevronDown, ChevronUp, User } from "lucide-react";
import { formatDateForDisplay, parseDateFromDB } from "@/lib/dateUtils";
import logoImage from "@/assets/logo-colegio.png";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Student {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  enrollment_date: string;
}

interface DebtDetail {
  monthlyDebt: number;
  activityDebts: { name: string; amount: number }[];
  totalDebt: number;
}

interface PaymentHistory {
  id: number;
  payment_date: string;
  amount: number;
  concept: string;
}

interface ScheduledActivity {
  id: string;
  name: string;
  scheduled_date: string;
  completed: boolean;
}

interface Notification {
  id: string;
  message: string;
  created_at: string;
}

interface Donation {
  id: string;
  name: string;
  amount: string;
  unit: string;
  donated_at: string | null;
  scheduled_activity: {
    name: string;
  };
}

import { useTenant } from "@/contexts/TenantContext";

export default function StudentProfile() {
  const { currentTenant } = useTenant();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentName, setStudentName] = useState("");
  const [debtDetail, setDebtDetail] = useState<DebtDetail | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<ScheduledActivity[]>([]);
  const [activityDonations, setActivityDonations] = useState<{ [activityId: string]: Donation[] }>({});
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);

  useEffect(() => {
    if (currentTenant) {
      loadStudents();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentData();
    }
  }, [selectedStudentId]);

  const loadStudents = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, enrollment_date")
        .eq("tenant_id", currentTenant.id)
        .order("last_name");

      if (error) throw error;

      const mappedStudents = (data || []).map(s => ({
        ...s,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Sin Nombre'
      }));

      setStudents(mappedStudents);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Error al cargar estudiantes");
    }
  };

  const loadStudentData = async () => {
    if (!selectedStudentId) return;

    try {
      setLoading(true);
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const [studentResult, paymentsResult, activitiesResult, exclusionsResult, scheduledActivitiesResult, notificationsResult, creditResult, creditMovementsResult] = await Promise.all([
        supabase.from("students").select("first_name, last_name, enrollment_date").eq("id", selectedStudentId).single() as unknown as Promise<any>,
        supabase.from("payments").select("*").eq("student_id", selectedStudentId).order("payment_date", { ascending: false }) as unknown as Promise<any>,
        supabase.from("activities").select("id, name, amount, activity_date").eq("tenant_id", currentTenant?.id) as unknown as Promise<any>,
        supabase.from("activity_exclusions").select("activity_id").eq("student_id", selectedStudentId) as unknown as Promise<any>,
        supabase.from("scheduled_activities").select("id, name, scheduled_date, completed").eq("tenant_id", currentTenant?.id).order("scheduled_date", { ascending: false }) as unknown as Promise<any>,
        supabase.from("dashboard_notifications").select("id, message, created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(5) as unknown as Promise<any>,
        supabase.from("student_credits").select("amount").eq("student_id", selectedStudentId).maybeSingle() as unknown as Promise<any>,
        supabase.from("credit_movements").select("amount, type").eq("student_id", selectedStudentId).eq("type", "payment_redirect") as unknown as Promise<any>,
      ]);

      if (studentResult.error) throw studentResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const fullName = `${studentResult.data.first_name || ''} ${studentResult.data.last_name || ''}`.trim() || 'Sin Nombre';
      setStudentName(fullName);
      setPaymentHistory(paymentsResult.data);
      setActivities(scheduledActivitiesResult.data || []);
      setNotifications(notificationsResult.data || []);
      setCreditBalance(creditResult.data?.amount || 0);

      // Obtener las dos actividades más próximas
      const futureActivities = (scheduledActivitiesResult.data || [])
        .filter(activity => new Date(activity.scheduled_date) >= new Date())
        .slice(0, 2);
      setUpcomingActivities(futureActivities);

      // Cargar donaciones para cada actividad próxima
      const donationsMap: { [activityId: string]: Donation[] } = {};
      for (const activity of futureActivities) {
        const { data: donations } = await supabase
          .from("activity_donations")
          .select(`
            id,
            name,
            amount,
            unit,
            donated_at,
            scheduled_activity:scheduled_activities(name)
          `)
          .eq("student_id", selectedStudentId)
          .eq("scheduled_activity_id", activity.id)
          .not("donated_at", "is", null);

        donationsMap[activity.id] = donations || [];
      }
      setActivityDonations(donationsMap);

      const totalPaidAmount = paymentsResult.data.reduce((sum, p) => sum + Number(p.amount), 0);
      setTotalPaid(totalPaidAmount);

      // Calcular deudas de cuotas mensuales
      // TODO: Get from Tenant Settings
      const settings = currentTenant?.settings as any;
      let monthlyFeeRaw = settings?.monthly_fee ? Number(settings.monthly_fee) : 3000;
      if (isNaN(monthlyFeeRaw)) monthlyFeeRaw = 3000;
      const MONTHLY_FEE = monthlyFeeRaw;

      const startMonth = 2; // Marzo
      const enrollmentDate = parseDateFromDB(studentResult.data.enrollment_date);
      const enrollmentMonth = enrollmentDate.getMonth();
      const enrollmentYear = enrollmentDate.getFullYear();

      let firstPaymentMonth = startMonth;
      if (enrollmentYear === currentYear && enrollmentMonth > startMonth) {
        firstPaymentMonth = enrollmentMonth;
      }

      let monthsToPay = 0;
      if (currentYear > enrollmentYear) {
        // Past years or current active year logic
        monthsToPay = Math.max(0, currentMonth - firstPaymentMonth + 1) + 12 * (currentYear - enrollmentYear);
        // Simplifying for single-year logic:
        // If we are significantly ahead, assume full debt?
        // For now, let's keep it scoped to current year logic:
        monthsToPay = Math.max(0, 11 - startMonth + 1); // Full year debt?
        // Let's refine:
        // If enrollment was 2026, and we are 2027 => Full 2026 debt + 2027 debt. 
        // But "monthsToPay" usually means "THIS YEAR's months".
        // Let's follow the original intent which was "months up to NOW".
        // If currentYear > enrollmentYear, we owe ALL months of this year (up to now).
        monthsToPay = Math.max(0, currentMonth - startMonth + 1);
      } else if (currentYear === enrollmentYear) {
        monthsToPay = Math.max(0, currentMonth - firstPaymentMonth + 1);
      } else {
        // currentYear < enrollmentYear (Future)
        monthsToPay = 0;
      }

      const expectedMonthlyFees = monthsToPay * MONTHLY_FEE;

      let paidMonthlyFees = paymentsResult.data
        .filter(p => p.concept?.toLowerCase().includes('cuota'))
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Add payment redirections (negative amounts = applied to monthly fees)
      const redirectionAmount = (creditMovementsResult.data || [])
        .filter(cm => cm.amount < 0)
        .reduce((sum, cm) => sum + Math.abs(Number(cm.amount)), 0);
      paidMonthlyFees += redirectionAmount;

      const monthlyDebt = Math.max(0, expectedMonthlyFees - paidMonthlyFees);

      // Calcular deudas de actividades
      const exclusionsSet = new Set(exclusionsResult.data?.map(e => e.activity_id) || []);
      const activityDebts: { name: string; amount: number }[] = [];

      const activityPayments = new Map<number, number>();

      for (const activity of activitiesResult.data || []) {
        const relatedPayments = paymentsResult.data.filter(p => {
          if (p.activity_id !== null && p.activity_id === activity.id) {
            return true;
          }

          const activityNameNormalized = activity.name.toUpperCase().trim().replace(/\s+/g, ' ');
          const conceptNormalized = (p.concept || '').toUpperCase().trim().replace(/\s+/g, ' ');

          return conceptNormalized.includes(activityNameNormalized);
        });

        const totalPaidForActivity = relatedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        activityPayments.set(activity.id, totalPaidForActivity);
      }

      for (const activity of activitiesResult.data || []) {
        if (!activity.activity_date) continue;

        const activityDate = new Date(activity.activity_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (activityDate > today) continue;
        if (exclusionsSet.has(activity.id)) continue;
        if (enrollmentDate > activityDate) continue;

        const paid = activityPayments.get(activity.id) || 0;
        const expectedAmount = Number(activity.amount);
        const owed = Math.max(0, expectedAmount - paid);

        if (owed > 0) {
          activityDebts.push({ name: activity.name, amount: owed });
        }
      }

      const totalDebt = monthlyDebt + activityDebts.reduce((sum, d) => sum + d.amount, 0);

      setDebtDetail({
        monthlyDebt,
        activityDebts,
        totalDebt,
      });
    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Error al cargar datos del estudiante");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  if (!currentTenant) return <div className="flex justify-center items-center h-screen">Cargando curso...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 sm:space-y-4">
          <img
            src={(currentTenant.settings as any)?.logo_url || logoImage}
            alt={currentTenant.name}
            className="h-16 sm:h-20 mx-auto object-contain"
          />
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white capitalize">
              {currentTenant.name}
            </h1>
            <p className="text-base sm:text-lg text-purple-600 dark:text-purple-400 font-semibold mt-1">¡Siempre Subir!</p>
          </div>
        </div>

        {/* Student Selector */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Seleccionar Estudiante
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="space-y-2">
              <Label htmlFor="student">Estudiante</Label>
              <Select
                value={selectedStudentId?.toString() || ""}
                onValueChange={(value) => setSelectedStudentId(Number(value))}
              >
                <SelectTrigger id="student">
                  <SelectValue placeholder="Selecciona un estudiante..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id.toString()}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedStudentId && !isNaN(selectedStudentId) && !loading && (
          <>
            {/* Welcome Message */}
            <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
              <CardContent className="pt-6 pb-6">
                <h2 className="text-xl sm:text-2xl font-bold">¡Hola, {studentName.split(' ')[0]}!</h2>
                <p className="text-purple-100 text-sm sm:text-base mt-1">Bienvenido a tu portal de pagos</p>
              </CardContent>
            </Card>

            {/* Notifications */}
            {notifications.length > 0 && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                    <FileText className="h-5 w-5" />
                    Avisos Importantes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {notifications.map((notification) => (
                    <div key={notification.id} className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notification.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
                  <div className="rounded-full p-2 bg-green-500/10">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(totalPaid)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Historial completo de pagos
                  </p>
                </CardContent>
              </Card>

              {creditBalance > 0 ? (
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo a Favor</CardTitle>
                    <div className="rounded-full p-2 bg-green-500/10">
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(creditBalance)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Crédito disponible
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Deuda Pendiente</CardTitle>
                    <div className="rounded-full p-2 bg-orange-500/10">
                      <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(debtDetail?.totalDebt || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Adeudado al mes actual
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Debt Detail */}
            {debtDetail && debtDetail.totalDebt > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    Detalle de Deudas Pendientes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {debtDetail.monthlyDebt > 0 && (
                    <div className="flex justify-between items-center p-3 bg-muted rounded">
                      <span className="font-medium">Cuotas Mensuales</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {formatCurrency(debtDetail.monthlyDebt)}
                      </span>
                    </div>
                  )}

                  {debtDetail.activityDebts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Actividades:</p>
                      {debtDetail.activityDebts.map((activity, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-muted/50 rounded">
                          <span>{activity.name}</span>
                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                            {formatCurrency(activity.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upcoming Activities */}
            {upcomingActivities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Próximas Actividades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingActivities.map((activity) => (
                    <div key={activity.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">{activity.name}</h4>
                        <Badge variant="outline">
                          {formatDateForDisplay(activity.scheduled_date)}
                        </Badge>
                      </div>
                      {activityDonations[activity.id] && activityDonations[activity.id].length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Tus donaciones:</p>
                          {activityDonations[activity.id].map((donation) => (
                            <div key={donation.id} className="text-sm bg-green-50 dark:bg-green-950 p-2 rounded">
                              ✓ {donation.name} - {donation.amount} {donation.unit}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Collapsible Payments History */}
            <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between p-6 h-auto hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full p-2 bg-green-500/10">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-base">Historial de Pagos</p>
                        <p className="text-sm text-muted-foreground">
                          {paymentHistory.length} {paymentHistory.length === 1 ? 'pago' : 'pagos'} registrados
                        </p>
                      </div>
                    </div>
                    {paymentsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-2 pt-0">
                    {paymentHistory.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center p-3 bg-muted rounded">
                        <div>
                          <p className="font-medium">{payment.concept}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateForDisplay(payment.payment_date)}
                          </p>
                        </div>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </>
        )}

        {loading && (
          <div className="text-center p-8 text-muted-foreground">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            Cargando información del estudiante...
          </div>
        )}
      </div>
    </div>
  );
}
