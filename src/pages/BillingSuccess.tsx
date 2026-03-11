import { CheckCircle2 } from "lucide-react";
import { BillingReturnState } from "@/components/subscription/BillingReturnState";

export default function BillingSuccess() {
  return (
    <BillingReturnState
      title="Pago recibido"
      description="Mercado Pago informó el pago. En cuanto el webhook lo valide, tu tenant quedará activo."
      icon={<CheckCircle2 className="h-7 w-7" />}
    />
  );
}
