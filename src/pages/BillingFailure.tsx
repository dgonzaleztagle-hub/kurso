import { XCircle } from "lucide-react";
import { BillingReturnState } from "@/components/subscription/BillingReturnState";

export default function BillingFailure() {
  return (
    <BillingReturnState
      title="Pago no completado"
      description="La operación fue cancelada o rechazada. Puedes volver a intentarlo desde el panel cuando quieras."
      icon={<XCircle className="h-7 w-7" />}
    />
  );
}
