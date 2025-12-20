import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, Bell, Calendar, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAuth } from "@/contexts/AuthContext";
import { MassNotificationDialog } from "@/components/MassNotificationDialog";
import { NotificationManagementDialog } from "@/components/NotificationManagementDialog";
import { parseDateFromDB } from "@/lib/dateUtils";

interface DebtDetail {
  studentId: number;
  studentName: string;
  monthlyDebt: number;
  activityDebts: { name: string; amount: number }[];
  totalDebt: number;
}

import { WelcomeGuide } from "@/components/onboarding/WelcomeGuide";

import { useTenant } from "@/contexts/TenantContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { currentTenant, refreshTenants } = useTenant();

  // Safe Fallback for display
  const userName = appUser?.full_name || "Usuario";
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    studentCount: 0,
    pendingNotifications: 0,
    pendingReimbursements: 0,
    pendingSupplierPayments: 0,
    monthlyIncome: 0,
    totalDebt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showDebtDetail, setShowDebtDetail] = useState(false);
  const [debtDetails, setDebtDetails] = useState<DebtDetail[]>([]);
  const [showMassNotification, setShowMassNotification] = useState(false);
  const [showManageNotifications, setShowManageNotifications] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];

      const [paymentsResult, expensesResult, studentsResult, notificationsResult, reimbursementsResult, monthlyPaymentsResult, activitiesResult, exclusionsResult, creditMovementsResult] = await Promise.all([
        supabase.from("payments").select("amount, student_id, concept, activity_id"),
        supabase.from("expenses").select("amount"),
        supabase.from("students").select("id, first_name, last_name, enrollment_date"),
        supabase.from("payment_notifications").select("id").eq("status", "pending"),
        supabase.from("reimbursements").select("id, type").eq("status", "pending"),
        supabase.from("payments").select("amount").gte("payment_date", firstDayOfMonth),
        supabase.from("activities").select("id, name, amount, activity_date"),
        supabase.from("activity_exclusions").select("student_id, activity_id"),
        supabase.from("credit_movements").select("student_id, amount, type").eq("type", "payment_redirect"),
      ]);

      if (paymentsResult.error) throw paymentsResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (studentsResult.error) throw studentsResult.error;

      // Map students to include full name
      const students = studentsResult.data.map(s => ({
        ...s,
        name: `${s.first_name} ${s.last_name}`.trim()
      }));

      const totalIncome = paymentsResult.data.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalExpenses = expensesResult.data.reduce((sum, e) => sum + Number(e.amount), 0);
      const monthlyIncome = monthlyPaymentsResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Calcular deuda total y detalles
      let totalDebt = 0;
      const details: DebtDetail[] = [];
      const MONTHLY_FEE = 3000;
      const currentMonthIndex = new Date().getMonth();
      const startMonth = 2;

      const exclusionsMap = new Map<number, Set<number>>();
      exclusionsResult.data?.forEach(exc => {
        if (!exclusionsMap.has(exc.student_id)) {
          exclusionsMap.set(exc.student_id, new Set());
        }
        exclusionsMap.get(exc.student_id)!.add(exc.activity_id);
      });

      // Mapear pagos de actividades - buscar por coincidencia de nombre/concepto
      const activityPayments = new Map<string, number>();

      // Para cada actividad, buscar pagos que contengan su nombre en el concepto
      for (const activity of activitiesResult.data || []) {
        const activityNameUpper = activity.name.toUpperCase();

        paymentsResult.data
          .filter(p => {
            // Buscar si el concepto del pago contiene el nombre de la actividad
            const conceptUpper = (p.concept || '').toUpperCase();
            return conceptUpper.includes(activityNameUpper) ||
              (p.activity_id !== null && p.activity_id === activity.id);
          })
          .forEach(p => {
            const key = `${p.student_id}_${activity.id}`;
            const current = activityPayments.get(key) || 0;
            activityPayments.set(key, current + Number(p.amount));
          });
      }

      // Calcular deudas por estudiante
      for (const student of students) {
        const enrollmentDate = parseDateFromDB(student.enrollment_date);
        const enrollmentMonth = enrollmentDate.getMonth();
        const enrollmentYear = enrollmentDate.getFullYear();

        let firstPaymentMonth = startMonth;
        if (enrollmentYear === currentYear && enrollmentMonth > startMonth) {
          firstPaymentMonth = enrollmentMonth;
        }

        const monthsToPay = Math.max(0, currentMonthIndex - firstPaymentMonth + 1);
        const expectedMonthlyFees = monthsToPay * MONTHLY_FEE;

        // Sumar redirecciones de pago (montos negativos representan cuotas cubiertas)
        const redirectedAmount = (creditMovementsResult.data || [])
          .filter(cm => cm.student_id === student.id && cm.amount < 0)
          .reduce((sum, cm) => sum + Math.abs(Number(cm.amount)), 0);

        const paidMonthlyFees = paymentsResult.data
          .filter(p => p.student_id === student.id && p.concept?.toLowerCase().includes('cuota'))
          .reduce((sum, p) => sum + Number(p.amount), 0) + redirectedAmount;

        const monthlyDebt = Math.max(0, expectedMonthlyFees - paidMonthlyFees);

        // Calcular deudas de actividades
        const activityDebts: { name: string; amount: number }[] = [];
        for (const activity of activitiesResult.data || []) {
          if (!activity.activity_date) continue;

          const activityDate = new Date(activity.activity_date);
          if (activityDate > new Date()) continue;

          if (exclusionsMap.get(student.id)?.has(activity.id)) continue;
          if (enrollmentDate > activityDate) continue;

          const key = `${student.id}_${activity.id}`;
          const paid = activityPayments.get(key) || 0;
          const owed = Math.max(0, Number(activity.amount) - paid);

          if (owed > 0) {
            activityDebts.push({ name: activity.name, amount: owed });
          }
        }

        const studentTotalDebt = monthlyDebt + activityDebts.reduce((sum, d) => sum + d.amount, 0);

        if (studentTotalDebt > 0) {
          details.push({
            studentId: student.id,
            studentName: student.name,
            monthlyDebt,
            activityDebts,
            totalDebt: studentTotalDebt,
          });
          totalDebt += studentTotalDebt;
        }
      }

      setDebtDetails(details.sort((a, b) => b.totalDebt - a.totalDebt));
      const reimbursements = reimbursementsResult.data || [];
      const pendingReimbursements = reimbursements.filter(r => r.type === 'reimbursement').length;
      const pendingSupplierPayments = reimbursements.filter(r => r.type === 'supplier_payment').length;

      setStats({
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
        studentCount: students.length,
        pendingNotifications: notificationsResult.data?.length || 0,
        pendingReimbursements,
        pendingSupplierPayments,
        monthlyIncome,
        totalDebt,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      toast.error("Error al cargar las estadísticas");
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

  const statCards = [
    {
      title: "Saldo Disponible",
      value: formatCurrency(stats.balance),
      icon: DollarSign,
      description: "Balance actual",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Ingresos del Mes",
      value: formatCurrency(stats.monthlyIncome),
      icon: TrendingUp,
      description: "Recaudado este mes",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Deuda Total Pendiente",
      value: formatCurrency(stats.totalDebt),
      icon: AlertCircle,
      description: "Adeudado al mes actual",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Estudiantes",
      value: stats.studentCount.toString(),
      icon: Users,
      description: "Total registrados",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Ingresos Totales",
      value: formatCurrency(stats.totalIncome),
      icon: TrendingUp,
      description: "Total recaudado",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "Egresos Totales",
      value: formatCurrency(stats.totalExpenses),
      icon: TrendingDown,
      description: "Total gastado",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-muted rounded-t-lg" />
            <CardContent className="h-24 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WelcomeGuide />
      {/* Header con logo y lema */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6 p-4 md:p-8">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto">
            <div className="w-16 h-16 md:w-24 md:h-24 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Calendar className="w-8 h-8 md:w-12 md:h-12 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent truncate">
                {currentTenant?.settings?.institution_name ? (
                  <>
                    <span className="font-normal text-muted-foreground">{currentTenant.settings.institution_name}</span>
                    <span className="mx-2 text-muted-foreground">/</span>
                    {currentTenant.name}
                  </>
                ) : (
                  currentTenant?.name || "Sistema de Gestión"
                )}
              </h1>
              <span className="text-sm md:text-lg font-semibold text-foreground">Panel General</span>
            </div>
            {/* Removed legacy position welcome */}
            <p className="text-sm md:text-xl font-semibold text-muted-foreground mt-0.5 md:mt-1">
              Gestión Inteligente
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:gap-3 w-full md:w-auto">
          <div className="flex gap-2 md:gap-3 w-full md:w-auto">
            <Button
              onClick={() => setShowMassNotification(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 md:gap-2 flex-1 md:flex-initial text-xs md:text-sm"
            >
              <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Nueva Notificación</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
            <Button
              onClick={() => setShowManageNotifications(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 md:gap-2 flex-1 md:flex-initial text-xs md:text-sm"
            >
              <Bell className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Gestionar
            </Button>
          </div>
          {stats.pendingNotifications > 0 && (
            <Card
              className="bg-amber-500/10 border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors w-full md:w-auto"
              onClick={() => navigate('/payment-notifications')}
            >
              <CardHeader className="pb-2 md:pb-3 px-3 md:px-6 pt-3 md:pt-6">
                <CardTitle className="text-xs md:text-sm flex items-center gap-1.5 md:gap-2">
                  <Bell className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-600 dark:text-amber-400" />
                  Notificaciones de Pagos
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                <div className="text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.pendingNotifications}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.pendingNotifications === 1 ? 'Pago por revisar' : 'Pagos por revisar'}
                </p>
              </CardContent>
            </Card>
          )}
          {stats.pendingReimbursements > 0 && (
            <Card
              className="bg-blue-500/10 border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors w-full md:w-auto"
              onClick={() => navigate('/reimbursements')}
            >
              <CardHeader className="pb-2 md:pb-3 px-3 md:px-6 pt-3 md:pt-6">
                <CardTitle className="text-xs md:text-sm flex items-center gap-1.5 md:gap-2">
                  <Bell className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600 dark:text-blue-400" />
                  Rendiciones Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                <div className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.pendingReimbursements}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.pendingReimbursements === 1 ? 'Rendición por revisar' : 'Rendiciones por revisar'}
                </p>
              </CardContent>
            </Card>
          )}
          {stats.pendingSupplierPayments > 0 && (
            <Card
              className="bg-purple-500/10 border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition-colors w-full md:w-auto"
              onClick={() => navigate('/reimbursements')}
            >
              <CardHeader className="pb-2 md:pb-3 px-3 md:px-6 pt-3 md:pt-6">
                <CardTitle className="text-xs md:text-sm flex items-center gap-1.5 md:gap-2">
                  <Bell className="h-3.5 w-3.5 md:h-4 md:w-4 text-purple-600 dark:text-purple-400" />
                  Pagos a Proveedores
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                <div className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.pendingSupplierPayments}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.pendingSupplierPayments === 1 ? 'Pago por revisar' : 'Pagos por revisar'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>


      {/* Empty State / Onboarding CTA */}
      {stats.studentCount === 0 && (
        <Card className="border-dashed border-primary/40 bg-primary/5 mb-8">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="bg-background p-4 rounded-full shadow-sm">
              <Users className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-bold">¡Todo listo para empezar! 🚀</h3>
              <p className="text-muted-foreground">
                Tu sistema está configurado. El siguiente paso es registrar a tu primer estudiante para comenzar a gestionar pagos.
              </p>
            </div>
            <Button onClick={() => navigate('/students')} size="lg" className="gap-2">
              <Users className="h-4 w-4" />
              Registrar Primer Estudiante
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Métricas principales */}
      <div>
        <h2 className="text-sm md:text-base lg:text-lg font-semibold mb-2 md:mb-3 lg:mb-4">Resumen General</h2>
        <div className="grid gap-2 md:gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
          {statCards.slice(0, 4).map((stat) => {
            const Icon = stat.icon;
            const isDebtCard = stat.title === "Deuda Total Pendiente";
            const CardWrapper = isDebtCard ? "button" : "div";

            return (
              <CardWrapper
                key={stat.title}
                onClick={isDebtCard ? () => setShowDebtDetail(true) : undefined}
                className={isDebtCard ? "text-left w-full" : ""}
              >
                <Card className={`overflow-hidden hover:shadow-lg transition-shadow ${isDebtCard ? 'cursor-pointer hover:border-orange-500' : ''}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
                    <CardTitle className="text-xs md:text-sm font-medium">{stat.title}</CardTitle>
                    <div className={`rounded-full p-1 md:p-1.5 lg:p-2 ${stat.bgColor}`}>
                      <Icon className={`h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <div className={`text-base md:text-lg lg:text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-0.5 md:mt-1">
                      {stat.description}
                      {isDebtCard && " (click para ver detalle)"}
                    </p>
                  </CardContent>
                </Card>
              </CardWrapper>
            );
          })}
        </div>
      </div>

      {/* Métricas totales */}
      <div>
        <h2 className="text-sm md:text-base lg:text-lg font-semibold mb-2 md:mb-3 lg:mb-4">Totales Acumulados</h2>
        <div className="grid gap-2 md:gap-3 lg:gap-4 grid-cols-1 md:grid-cols-2">
          {statCards.slice(4).map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
                  <CardTitle className="text-xs md:text-sm font-medium">{stat.title}</CardTitle>
                  <div className={`rounded-full p-1 md:p-1.5 lg:p-2 ${stat.bgColor}`}>
                    <Icon className={`h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                  <div className={`text-base md:text-lg lg:text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-0.5 md:mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Información del sistema */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Funcionalidades del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            Este sistema te permite gestionar de forma eficiente:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
            <li>Registro de estudiantes y sus datos</li>
            <li>Gestión de cuotas mensuales</li>
            <li>Control de actividades y exclusiones</li>
            <li>Portal de pagos para apoderados</li>
            <li>Aprobación de pagos informados</li>
            <li>Ingreso y control de egresos</li>
            <li>Generación de comprobantes en PDF</li>
            <li>Informes detallados de deudas y pagos</li>
            <li>Balance financiero en tiempo real</li>
          </ul>
        </CardContent>
      </Card>

      {/* Dialog de detalle de deudas */}
      <Dialog open={showDebtDetail} onOpenChange={setShowDebtDetail}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalle de Deudas Pendientes</DialogTitle>
            <DialogDescription>
              Desglose completo de deudas al mes actual por estudiante
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            {debtDetails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ¡No hay deudas pendientes! 🎉
              </div>
            ) : (
              <div className="space-y-4">
                {debtDetails.map((detail) => (
                  <Card key={detail.studentId}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{detail.studentName}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            ID: {detail.studentId}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-lg px-3 py-1">
                          {formatCurrency(detail.totalDebt)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {detail.monthlyDebt > 0 && (
                        <div className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="text-sm font-medium">Cuotas Mensuales</span>
                          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            {formatCurrency(detail.monthlyDebt)}
                          </span>
                        </div>
                      )}

                      {detail.activityDebts.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Actividades:</p>
                          {detail.activityDebts.map((activity, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
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
                ))}

                <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">Total General</span>
                      <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {formatCurrency(stats.totalDebt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {debtDetails.length} estudiante{debtDetails.length !== 1 ? 's' : ''} con deudas pendientes
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <MassNotificationDialog
        open={showMassNotification}
        onOpenChange={setShowMassNotification}
      />

      <NotificationManagementDialog
        open={showManageNotifications}
        onOpenChange={setShowManageNotifications}
      />
    </div >
  );
}