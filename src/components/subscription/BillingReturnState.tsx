import { ReactNode, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MercadoPagoBadge } from "./MercadoPagoBadge";

type Props = {
  title: string;
  description: string;
  icon: ReactNode;
};

export function BillingReturnState({ title, description, icon }: Props) {
  const lastCheckout = useMemo(() => {
    if (typeof window === "undefined") return null;

    try {
      return JSON.parse(sessionStorage.getItem("kurso_last_checkout_offer") ?? "null") as {
        amount?: number;
        currency?: string;
        label?: string;
      } | null;
    } catch {
      return null;
    }
  }, []);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-xl border-sky-200">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto">
            <MercadoPagoBadge />
          </div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-[#009EE3]">
            {icon}
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {lastCheckout?.label && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Ultimo intento de cobro</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{lastCheckout.label}</p>
              <p className="text-sm text-slate-500">Renovacion manual, sin activacion desde el navegador.</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            El estado final del plan depende exclusivamente de la validación server-to-server del webhook de Mercado Pago.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild>
              <Link to="/dashboard">Volver al panel</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Ir al inicio</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
