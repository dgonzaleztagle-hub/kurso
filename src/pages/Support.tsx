import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { resolveBranding } from "@/lib/branding";
import { submitSupportTicket } from "@/lib/supportTickets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const REQUEST_TYPES = [
  { value: "support", label: "Soporte general" },
  { value: "payments", label: "Pagos y notificaciones" },
  { value: "credits", label: "Créditos y saldos a favor" },
  { value: "security", label: "Seguridad / historial de cambios" },
  { value: "privacy", label: "Privacidad" },
  { value: "arco_access", label: "ARCO: acceso" },
  { value: "arco_rectification", label: "ARCO: rectificación" },
  { value: "arco_cancellation", label: "ARCO: cancelación" },
  { value: "arco_opposition", label: "ARCO: oposición" },
  { value: "account_deletion", label: "Eliminación de cuenta" },
] as const;

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
  requestType: string;
};

const Support = () => {
  const { appUser, user } = useAuth();
  const { currentTenant } = useTenant();
  const branding = resolveBranding(currentTenant?.settings, currentTenant?.name);
  const isAuthenticated = Boolean(user);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(() => ({
    name: appUser?.full_name || "",
    email: user?.email || appUser?.email || "",
    subject: "",
    message: "",
    requestType: "support",
  }));

  const faqs = useMemo(() => ([
    {
      question: "¿Cuál es la diferencia entre un pago informado y un pago aprobado?",
      answer:
        "Un pago informado es el comprobante que el apoderado o usuario guardian envía al sistema. Un pago aprobado es el que la directiva revisa y valida desde Notificaciones de Pago. Solo después de esa aprobación el movimiento pasa al libro financiero real del curso.",
    },
    {
      question: "¿Cómo funciona el saldo a favor y la redirección de pagos?",
      answer:
        "Cuando un estudiante tiene crédito disponible, Kurso puede aplicar ese saldo a deudas o cuotas futuras. La redirección no inventa dinero nuevo: mueve saldo ya reconocido dentro del flujo financiero del estudiante y deja trazabilidad en los movimientos de crédito.",
    },
    {
      question: "¿Para qué sirve el Historial de cambios?",
      answer:
        "El Historial de cambios registra acciones críticas de administración y sirve como capa de transparencia. Permite revisar qué se hizo, cuándo y sobre qué entidad, reduciendo opacidad en la gestión del curso.",
    },
  ]), []);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name || !form.email || !form.subject || !form.message) {
      toast.error("Completa nombre, email, asunto y mensaje.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await submitSupportTicket({
        ...form,
        source: "support_page",
        tenantId: currentTenant?.id ?? null,
        tenantName: currentTenant?.name ?? null,
      });

      toast.success(
        response.followUpChannel === "in_app"
          ? "Tu ticket fue creado. El seguimiento quedo disponible dentro de la app."
          : "Tu solicitud fue enviada. La respuesta sera manual por correo.",
      );
      setForm((current) => ({
        ...current,
        subject: "",
        message: "",
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Soporte | {branding.appName}</title>
        <meta
          name="description"
          content="Soporte oficial de mikurso.cl, incluyendo formulario directo, email de asistencia y preguntas frecuentes operativas."
        />
        <link rel="canonical" href="https://mikurso.cl/soporte" />
      </Helmet>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">mikurso.cl</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Soporte y Ayuda</h1>
            <p className="mt-3 text-muted-foreground">
              Canal oficial de asistencia operativa, técnica, privacidad y App Review.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Volver al inicio
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Formulario de contacto directo</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isAuthenticated
                    ? "Como estas con sesion iniciada, el ticket quedara asociado a tu cuenta y podras seguirlo dentro de la app."
                    : "Si no tienes acceso a tu cuenta, puedes usar este canal de contingencia. La respuesta sera manual por correo."}
                </p>
              </div>

              {isAuthenticated && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p>
                    Curso actual: <span className="font-medium text-foreground">{currentTenant?.name || "Sin tenant activo"}</span>
                  </p>
                  <p className="mt-1">
                    El owner del curso se resuelve automaticamente por tenant. No necesitas escribir su correo.
                  </p>
                  <div className="mt-3">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/support/inbox">Ver tickets y respuestas</Link>
                    </Button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="support-name">Nombre</Label>
                    <Input
                      id="support-name"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support-email">Correo electrónico</Label>
                    <Input
                      id="support-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="nombre@ejemplo.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-type">Tipo de solicitud</Label>
                  <select
                    id="support-type"
                    value={form.requestType}
                    onChange={(e) => handleChange("requestType", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {REQUEST_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-subject">Asunto</Label>
                  <Input
                    id="support-subject"
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    placeholder="Ej: Solicitud ARCO / Problema con pago / Cuenta eliminada"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-message">Mensaje</Label>
                  <Textarea
                    id="support-message"
                    value={form.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    placeholder="Describe tu caso con el mayor detalle posible."
                    rows={8}
                  />
                </div>

                <Button type="submit" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar solicitud"}
                </Button>
              </form>
            </div>
          </Card>

          <div className="space-y-8">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground">Canal de soporte</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>
                  Email de asistencia:{" "}
                  <a className="font-medium text-primary hover:underline" href="mailto:contacto@hojacero.cl">
                    contacto@hojacero.cl
                  </a>
                </p>
                <p>
                  Sitio oficial:{" "}
                  <a className="font-medium text-primary hover:underline" href="https://mikurso.cl" target="_blank" rel="noreferrer">
                    https://mikurso.cl
                  </a>
                </p>
                <p>
                  Seguimiento:
                  {" "}
                  {isAuthenticated ? "si creas el ticket con sesion iniciada, la conversacion sigue dentro de la app." : "si envias el formulario sin sesion, la respuesta sera manual por correo."}
                </p>
                <p>
                  Para privacidad y cuenta también puedes revisar{" "}
                  <Link to="/privacidad" className="font-medium text-primary hover:underline">
                    /privacidad
                  </Link>{" "}
                  y{" "}
                  <Link to="/privacy-choices" className="font-medium text-primary hover:underline">
                    Derechos ARCO
                  </Link>.
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground">Preguntas frecuentes</h2>
              <div className="mt-4 space-y-5">
                {faqs.map((faq) => (
                  <div key={faq.question} className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{faq.question}</h3>
                    <p className="text-sm leading-7 text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Support;
