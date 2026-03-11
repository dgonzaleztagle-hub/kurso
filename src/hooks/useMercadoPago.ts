import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";

type CheckoutResult = {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint?: string | null;
  pricingStage: string;
  amount: number;
  currency: string;
  label: string;
};

export const useMercadoPago = () => {
  const { user, appUser } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    if (!user || !currentTenant?.id) {
      toast.error("No se pudo resolver el tenant para iniciar el cobro.");
      return null;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke<CheckoutResult>("mercadopago-checkout", {
        body: {
          tenantId: currentTenant.id,
          tenantEmail: appUser?.email ?? user.email,
          tenantName: appUser?.full_name ?? currentTenant.name,
          appUrl: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.initPoint) {
        throw new Error("Mercado Pago no devolvió un link de checkout.");
      }

      sessionStorage.setItem("kurso_last_checkout_offer", JSON.stringify({
        pricingStage: data.pricingStage,
        amount: data.amount,
        currency: data.currency,
        label: data.label,
      }));

      window.location.href = data.initPoint;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible iniciar el checkout.";
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    startCheckout,
    loading,
  };
};
