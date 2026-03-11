import { Clock3 } from "lucide-react";
import { BillingReturnState } from "@/components/subscription/BillingReturnState";

export default function BillingPending() {
  return (
    <BillingReturnState
      title="Pago pendiente"
      description="Mercado Pago dejó la operación en estado pendiente. Tu plan no cambiará hasta recibir confirmación aprobada."
      icon={<Clock3 className="h-7 w-7" />}
    />
  );
}
