import { AlertTriangle, Clock3, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTenant } from "@/contexts/TenantContext";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { getTenantBillingState } from "@/lib/saasBilling";
import { MercadoPagoBadge } from "./MercadoPagoBadge";

type Props = {
  compact?: boolean;
};

export function SaasBillingBanner({ compact = false }: Props) {
  const { currentTenant } = useTenant();
  const { startCheckout, loading } = useMercadoPago();

  if (!currentTenant) return null;

  const state = getTenantBillingState(currentTenant);
  if (!state.shouldShowPaymentCTA) return null;

  let title = "Activa tu suscripcion";
  let description = state.offer.summary;

  if (currentTenant.subscription_status === "trial" && (state.trialDaysRemaining ?? 0) >= 0) {
    title = `Tu prueba termina en ${state.trialDaysRemaining} dia(s)`;
    description = `${state.offer.label}. ${state.offer.renewalCopy}`;
  } else if (state.isTrialExpired) {
    title = "Tu prueba terminó, pero mantienes el precio de lanzamiento";
    description = `Activa hoy por ${state.offer.label.toLowerCase()} y el acceso volverá cuando Mercado Pago confirme el pago.`;
  } else if (state.isPastDue || state.isActiveExpired) {
    title = "Tu plan está vencido";
    description = `Renueva ahora. ${state.offer.summary} ${state.offer.renewalCopy}`;
  } else if (state.isNearExpiry) {
    title = `Tu plan vence en ${state.activeDaysRemaining} dia(s)`;
    description = `${state.offer.summary} ${state.offer.renewalCopy}`;
  }

  const icon = state.isNearExpiry ? <Clock3 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />;

  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-[#009EE3]/10 p-2 text-[#009EE3]">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{title}</p>
            <MercadoPagoBadge compact />
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Pago protegido
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Activacion automatica al confirmar
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
              Sin cobros automáticos
            </span>
          </div>
        </div>
      </div>
      <Button onClick={() => void startCheckout()} disabled={loading} className="gap-2 bg-[#009EE3] hover:bg-[#0088C7]">
        <CreditCard className="h-4 w-4" />
        {loading ? "Redirigiendo..." : `Pagar con Mercado Pago ${state.offer.amount ? `· ${state.offer.label}` : ""}`}
      </Button>
    </>
  );

  if (compact) {
    return <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-4 md:flex-row md:items-center md:justify-between">{content}</div>;
  }

  return (
    <Card className="border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50">
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        {content}
      </CardContent>
    </Card>
  );
}
