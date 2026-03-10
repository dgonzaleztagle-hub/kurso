import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentDashboardData } from "@/hooks/useStudentDashboardData";
import { formatDateForDisplay } from "@/lib/dateUtils";
import { AlertCircle, CreditCard, DollarSign, FileText } from "lucide-react";

export default function MobileFinances() {
  const { studentId } = useAuth();
  const { debtDetail, paymentHistory, totalPaid, creditBalance, loading } = useStudentDashboardData(studentId);

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
          <p className="mt-4 text-muted-foreground">Cargando finanzas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Finanzas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vista detallada de pagos, deuda y saldo a favor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Total Pagado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Historial acumulado de pagos registrados.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {creditBalance > 0 ? (
                <CreditCard className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              {creditBalance > 0 ? "Saldo a Favor" : "Deuda Pendiente"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${creditBalance > 0 ? "text-green-600" : "text-orange-600"}`}>
              {formatCurrency(creditBalance > 0 ? creditBalance : debtDetail?.totalDebt || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {creditBalance > 0 ? "Crédito disponible para aplicar." : "Monto adeudado al día de hoy."}
            </p>
          </CardContent>
        </Card>
      </div>

      {creditBalance <= 0 && debtDetail && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Desglose de Deuda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {debtDetail.monthlyDebt > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-orange-50 p-3">
                <span className="text-sm">Cuotas Mensuales</span>
                <span className="font-semibold text-orange-600">{formatCurrency(debtDetail.monthlyDebt)}</span>
              </div>
            )}
            {debtDetail.activityDebts.length === 0 && debtDetail.monthlyDebt === 0 && (
              <p className="text-sm text-muted-foreground">No hay deudas desglosadas.</p>
            )}
            {debtDetail.activityDebts.map((activity, index) => (
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
            Historial Completo de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {paymentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pagos registrados aún.</p>
          ) : (
            paymentHistory.map((payment) => (
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
