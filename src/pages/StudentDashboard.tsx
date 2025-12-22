import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, AlertCircle, Calendar, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import logoImage from "@/assets/logo-colegio.png";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateForDisplay, parseDateFromDB } from "@/lib/dateUtils";

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

export default function StudentDashboard() {
  const { studentId, displayName } = useAuth();
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [debtDetail, setDebtDetail] = useState<DebtDetail | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<ScheduledActivity[]>([]);
  const [activityDonations, setActivityDonations] = useState<{ [activityId: string]: Donation[] }>({});
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);

  useEffect(() => {
    if (studentId) {
      loadStudentData();
    }
  }, [studentId]);

  const loadStudentData = async () => {
    try {
      if (!studentId) return;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const [studentResult, paymentsResult, activitiesResult, exclusionsResult, scheduledActivitiesResult, notificationsResult, creditResult, creditMovementsResult] = await Promise.all([
        supabase.from("students").select("first_name, last_name, enrollment_date").eq("id", studentId).single(),
        supabase.from("payments").select("*").eq("student_id", studentId).order("payment_date", { ascending: false }),
        supabase.from("activities").select("id, name, amount, activity_date"),
        supabase.from("activity_exclusions").select("activity_id").eq("student_id", studentId),
        supabase.from("scheduled_activities").select("id, name, scheduled_date, completed").order("scheduled_date", { ascending: false }),
        supabase.from("dashboard_notifications").select("id, message, created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("student_credits").select("amount").eq("student_id", studentId).single(),
        supabase.from("credit_movements").select("amount, type").eq("student_id", studentId).eq("type", "payment_redirect"),
      ]);

      if (studentResult.error) throw studentResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const fullName = `${studentResult.data.first_name || ''} ${studentResult.data.last_name || ''}`.trim() || 'Sin Nombre';
      setStudentName(fullName);
      setPaymentHistory(paymentsResult.data);
      setActivities(scheduledActivitiesResult.data || []);
      setNotifications(notificationsResult.data || []);
      setCreditBalance(creditResult.data?.amount || 0);

      // Obtener la actividad más cercana no completada
      const activeActivities = (scheduledActivitiesResult.data || [])
        .filter(act => !act.completed)
        .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
        .slice(0, 2);

      setUpcomingActivities(activeActivities);

      // Cargar donaciones para las próximas 2 actividades
      const donationsMap: { [activityId: string]: Donation[] } = {};

      for (const nextAct of activeActivities) {
        const { data: nextActDonations } = await supabase
          .from("activity_donations")
          .select("id, name, amount, unit, donated_at")
          .eq("student_id", studentId)
          .eq("scheduled_activity_id", nextAct.id)
          .order("created_at", { ascending: false });

        if (nextActDonations && nextActDonations.length > 0) {
          donationsMap[nextAct.id] = nextActDonations.map(d => ({
            ...d,
            scheduled_activity: { name: nextAct.name }
          }));
        } else {
          donationsMap[nextAct.id] = [];
        }
      }

      setActivityDonations(donationsMap);

      const totalPaidAmount = paymentsResult.data.reduce((sum, p) => sum + Number(p.amount), 0);
      setTotalPaid(totalPaidAmount);

      // Calcular deudas
      const MONTHLY_FEE = 3000;
      const startMonth = 2; // Marzo
      const enrollmentDate = parseDateFromDB(studentResult.data.enrollment_date);
      const enrollmentMonth = enrollmentDate.getMonth();
      const enrollmentYear = enrollmentDate.getFullYear();

      let firstPaymentMonth = startMonth;
      if (enrollmentYear === currentYear && enrollmentMonth > startMonth) {
        firstPaymentMonth = enrollmentMonth;
      }

      const monthsToPay = Math.max(0, currentMonth - firstPaymentMonth + 1);
      const expectedMonthlyFees = monthsToPay * MONTHLY_FEE;

      // Sumar redirecciones de pago (montos negativos representan cuotas cubiertas)
      const redirectedAmount = (creditMovementsResult.data || [])
        .filter(cm => cm.amount < 0)
        .reduce((sum, cm) => sum + Math.abs(Number(cm.amount)), 0);

      const paidMonthlyFees = paymentsResult.data
        .filter(p => p.concept?.toLowerCase().includes('cuota'))
        .reduce((sum, p) => sum + Number(p.amount), 0) + redirectedAmount;

      const monthlyDebt = Math.max(0, expectedMonthlyFees - paidMonthlyFees);

      // Calcular deudas de actividades
      const exclusionsSet = new Set(exclusionsResult.data?.map(e => e.activity_id) || []);
      const activityDebts: { name: string; amount: number }[] = [];

      // Primero calcular lo pagado por cada actividad
      const activityPayments = new Map<number, number>();

      for (const activity of activitiesResult.data || []) {
        // Sumar todos los pagos relacionados con esta actividad
        const relatedPayments = paymentsResult.data.filter(p => {
          // Primero verificar si está vinculado directamente por activity_id
          if (p.activity_id !== null && p.activity_id === activity.id) {
            return true;
          }

          // Si no tiene activity_id, verificar por concepto
          // Normalizar ambos strings para comparación
          const activityNameNormalized = activity.name.toUpperCase().trim().replace(/\s+/g, ' ');
          const conceptNormalized = (p.concept || '').toUpperCase().trim().replace(/\s+/g, ' ');

          // El concepto debe contener el nombre completo de la actividad
          return conceptNormalized.includes(activityNameNormalized);
        });

        const totalPaid = relatedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        activityPayments.set(activity.id, totalPaid);

        // Debug: mostrar qué se encontró para esta actividad
        if (totalPaid > 0) {
          console.log(`Actividad "${activity.name}": Monto esperado $${activity.amount}, Pagado $${totalPaid}`);
        }
      }

      // Ahora verificar qué actividades tienen deuda
      for (const activity of activitiesResult.data || []) {
        // Solo considerar actividades con fecha
        if (!activity.activity_date) continue;

        const activityDate = new Date(activity.activity_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Solo considerar actividades que ya pasaron
        if (activityDate > today) continue;

        // Excluir si el alumno está excluido de esta actividad
        if (exclusionsSet.has(activity.id)) continue;

        // Excluir si el alumno se matriculó después de la actividad
        if (enrollmentDate > activityDate) continue;

        const paid = activityPayments.get(activity.id) || 0;
        const expectedAmount = Number(activity.amount);
        const owed = Math.max(0, expectedAmount - paid);

        // Debug: mostrar todas las actividades evaluadas
        console.log(`Evaluando "${activity.name}": Esperado $${expectedAmount}, Pagado $${paid}, Adeudado $${owed}`);

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
      toast.error("Error al cargar tus datos");
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Validación de seguridad: usuario sin estudiante vinculado
  if (!studentId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-destructive">Error de Configuración</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Tu cuenta no está vinculada a ningún estudiante. Por favor contacta al administrador para resolver este problema.
            </p>
            <Button onClick={() => {
              supabase.auth.signOut();
              window.location.href = '/auth';
            }} variant="outline" className="w-full">
              Cerrar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Próximas 2 actividades */}
      {upcomingActivities.map((activity) => (
        <Card key={activity.id} className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Próxima Actividad
                </p>
                <p className="text-base font-bold text-primary mt-1">
                  {activity.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fecha: {format(parseDateFromDB(activity.scheduled_date), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>

            {/* Donaciones de la actividad */}
            {activityDonations[activity.id]?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground mb-2">Tus donaciones:</p>
                <div className="space-y-2">
                  {activityDonations[activity.id].map((donation) => (
                    <div
                      key={donation.id}
                      className="flex items-center justify-between p-2 bg-background/50 rounded-md"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{donation.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {donation.amount} {donation.unit}
                        </p>
                      </div>
                      <Badge
                        variant={donation.donated_at ? "default" : "secondary"}
                        className={donation.donated_at ? "bg-green-100 text-green-700 hover:bg-green-100 text-xs" : "text-xs"}
                      >
                        {donation.donated_at ? "Recibida" : "Pendiente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Notificaciones activas */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification.id} className="bg-primary/5 border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(notification.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 p-4 md:p-8">
          <div className="flex items-center gap-4 md:gap-6">
            <img
              src={logoImage}
              alt="Logo del Colegio"
              className="w-16 h-16 md:w-24 md:h-24 object-contain"
            />
            <div>
              <h1 className="text-xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Portal de Apoderados
              </h1>
              <p className="text-xs md:text-sm font-semibold text-primary mt-1">¡Siempre Subir!</p>
              {displayName && (
                <p className="text-sm md:text-lg text-muted-foreground mt-2">
                  Bienvenido/a {displayName}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="grid gap-4 md:grid-cols-2">
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
              Historial de pagos realizados
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

      {/* Detalle de deudas */}
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

      {/* Botón informar pago */}
      <Card>
        <CardContent className="pt-6">
          <Button onClick={() => navigate("/payment-portal")} className="w-full" size="lg">
            <DollarSign className="mr-2 h-5 w-5" />
            Informar Nuevo Pago
          </Button>
        </CardContent>
      </Card>

      {/* Sección Actividades - Colapsable */}
      <Collapsible open={activitiesOpen} onOpenChange={setActivitiesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-6 h-auto hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2 bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-base">Actividades Programadas</p>
                  <p className="text-sm text-muted-foreground">
                    {activities.length} {activities.length === 1 ? 'actividad' : 'actividades'}
                  </p>
                </div>
              </div>
              {activitiesOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              {activities.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  No hay actividades registradas
                </p>
              ) : (
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{activity.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseDateFromDB(activity.scheduled_date), "dd 'de' MMMM, yyyy", { locale: es })}
                        </p>
                      </div>
                      {activity.completed && (
                        <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                          Completada
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sección Historial de Pagos - Colapsable */}
      <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-6 h-auto hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2 bg-green-500/10">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-base">Historial de Pagos</p>
                  <p className="text-sm text-muted-foreground">
                    {paymentHistory.length} {paymentHistory.length === 1 ? 'pago realizado' : 'pagos realizados'}
                  </p>
                </div>
              </div>
              {paymentsOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              {paymentHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  No hay pagos registrados aún
                </p>
              ) : (
                <div className="space-y-2">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{payment.concept}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateForDisplay(payment.payment_date)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {formatCurrency(Number(payment.amount))}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
