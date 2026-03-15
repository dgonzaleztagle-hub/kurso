import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CreditCard, MessageSquare, ShieldCheck } from "lucide-react";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { useTenant } from "@/contexts/TenantContext";
import { getTenantBillingState } from "@/lib/saasBilling";
import { MercadoPagoBadge } from "./MercadoPagoBadge";
import { PromoCodeField } from "./PromoCodeField";

interface LockModalProps {
  isOpen: boolean;
  isGracePeriod: boolean;
}

export function LockModal({ isOpen, isGracePeriod }: LockModalProps) {
  const { startCheckout, loading } = useMercadoPago();
  const { currentTenant } = useTenant();
  const state = getTenantBillingState(currentTenant);
  const [promoCode, setPromoCode] = useState("");

  const handleInteractOutside = (e: Event) => {
    e.preventDefault();
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="sm:max-w-lg overflow-hidden border-0 p-0 [&>button]:hidden"
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={handleInteractOutside}
      >
        <div className="bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6">
          <DialogHeader className="space-y-4">
            <div className="mx-auto">
              <MercadoPagoBadge />
            </div>
            <DialogTitle className="text-center text-2xl font-bold text-slate-900">
              Tu acceso está pausado
            </DialogTitle>
            <DialogDescription className="text-center text-base text-slate-600">
              Conserva la oferta de entrada de Kurso: 7 dias gratis, luego activas tu curso por $5.000 el primer mes y después sigues con $9.900 por renovacion manual.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 rounded-2xl border border-sky-200 bg-white/90 p-4 shadow-sm">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Oferta activa</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{state.offer.label}</p>
              <p className="mt-1 text-sm text-slate-500">{state.offer.renewalCopy}</p>
            </div>
          </div>

          {isGracePeriod && (
            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-center text-sm font-medium text-orange-800">
              Tienes 3 dias de gracia antes del bloqueo definitivo del periodo actual.
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Pago protegido y activacion automatica al confirmar
            </span>
            <span className="text-center">Sin cobros automaticos. Renovas mes a mes cuando quieras.</span>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
              <PromoCodeField value={promoCode} onChange={setPromoCode} disabled={loading} />
            </div>
            <Button
              className="h-12 bg-[#009EE3] text-base font-semibold hover:bg-[#0088C7]"
              onClick={() => void startCheckout({ promoCode })}
              disabled={loading}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              {loading ? "Redirigiendo..." : `Pagar con Mercado Pago · ${state.offer.label}`}
            </Button>
            <Button
              className="h-12 bg-[#25D366] text-base font-semibold text-white hover:bg-[#128C7E]"
              onClick={() => window.open("https://wa.me/56972739105", "_blank")}
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              Hablar por WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
