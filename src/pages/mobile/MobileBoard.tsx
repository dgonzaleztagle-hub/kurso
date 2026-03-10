import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentDashboardData } from "@/hooks/useStudentDashboardData";
import { formatDateForDisplay, parseDateFromDB } from "@/lib/dateUtils";
import { AlertCircle, Calendar, CreditCard, DollarSign, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function MobileBoard() {
  const { studentId, displayName } = useAuth();
  const navigate = useNavigate();
  const {
    debtDetail,
    paymentHistory,
    notifications,
    upcomingActivities,
    activityDonations,
    totalPaid,
    creditBalance,
    loading,
  } = useStudentDashboardData(studentId);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);

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

  if (!studentId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error de Configuración</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Tu cuenta no está vinculada a un alumno. Contacta al administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-4 max-w-md mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 shadow-lg">
        <p className="text-sm text-primary-foreground/80">Panel del Apoderado</p>
        <h1 className="text-2xl font-bold mt-1">{displayName ? `Hola, ${displayName}` : "Hola"}</h1>
        <p className="text-sm text-primary-foreground/80 mt-2">
          Aquí ves pagos, deudas, actividades y avisos del curso.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Total Pagado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className={`h-4 w-4 ${creditBalance > 0 ? "text-green-600" : "text-orange-600"}`} />
              {creditBalance > 0 ? "Saldo a Favor" : "Deuda"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${creditBalance > 0 ? "text-green-600" : "text-orange-600"}`}>
              {formatCurrency(creditBalance > 0 ? creditBalance : debtDetail?.totalDebt || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="pt-6">
          <Button onClick={() => navigate("/payment-portal")} className="w-full h-11">
            <CreditCard className="mr-2 h-4 w-4" />
            Informar Nuevo Pago
          </Button>
        </CardContent>
      </Card>

      {notifications.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avisos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-xl bg-primary/5 border border-primary/10 p-3">
                <p className="text-sm whitespace-pre-wrap">{notification.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(notification.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {upcomingActivities.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Próximas Actividades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingActivities.map((activity) => (
              <div key={activity.id} className="rounded-xl border p-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-primary mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{activity.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseDateFromDB(activity.scheduled_date), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                </div>

                {activityDonations[activity.id]?.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Tus donaciones</p>
                    {activityDonations[activity.id].map((donation) => (
                      <div key={donation.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
                        <div>
                          <p className="text-sm font-medium">{donation.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {donation.amount} {donation.unit}
                          </p>
                        </div>
                        <Badge variant={donation.donated_at ? "default" : "secondary"}>
                          {donation.donated_at ? "Recibida" : "Pendiente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(debtDetail?.totalDebt || 0) > 0 && creditBalance <= 0 && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-orange-600">Detalle de Deuda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {debtDetail?.monthlyDebt ? (
              <div className="flex items-center justify-between rounded-lg bg-orange-50 p-3">
                <span className="text-sm">Cuotas Mensuales</span>
                <span className="font-semibold text-orange-600">{formatCurrency(debtDetail.monthlyDebt)}</span>
              </div>
            ) : null}

            {debtDetail?.activityDebts.map((activity, index) => (
              <div key={`${activity.name}-${index}`} className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <span className="text-sm">{activity.name}</span>
                <span className="font-semibold text-orange-600">{formatCurrency(activity.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Historial de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {paymentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pagos registrados aún.</p>
          ) : (
            paymentHistory.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-medium truncate">{payment.concept}</p>
                  <p className="text-xs text-muted-foreground">{formatDateForDisplay(payment.payment_date)}</p>
                </div>
                <Badge variant="secondary">{formatCurrency(Number(payment.amount))}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
