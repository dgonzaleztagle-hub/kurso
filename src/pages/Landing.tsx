import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { ReactNode, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  HelpCircle,
  LineChart,
  MessageCircle,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MercadoPagoBadge } from "@/components/subscription/MercadoPagoBadge";
import { resolveBranding } from "@/lib/branding";
import { SAAS_PRICING, formatCurrencyCLP } from "@/lib/saasBilling";

const SEO_LINKS = [
  { title: "Tesorería escolar", path: "/tesoreria-escolar" },
  { title: "Control de cuotas", path: "/control-cuotas-curso" },
  { title: "Pagos de apoderados", path: "/pagos-apoderados" },
  { title: "Gastos e ingresos", path: "/gastos-e-ingresos-curso" },
  { title: "Gratis vs profesional", path: "/tesoreria-escolar-gratis-vs-profesional" },
  { title: "Alternativa a Excel", path: "/alternativa-a-excel-para-cuotas" },
];

const GUIDE_LINKS = [
  { title: "Cómo llevar la tesorería de un curso", path: "/como-llevar-la-tesoreria-de-un-curso" },
  { title: "Cómo cobrar cuotas sin WhatsApp", path: "/como-cobrar-cuotas-de-curso-sin-whatsapp" },
  { title: "Cómo rendir gastos a apoderados", path: "/como-rendir-gastos-de-curso-a-apoderados" },
];

const Landing = () => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const branding = resolveBranding();
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/20">
      <Helmet>
        <title>Kurso | Tesorería escolar con menos cobranza manual y más control</title>
        <meta
          name="description"
          content="Kurso ayuda a cursos y centros de padres a controlar cuotas, pagos de apoderados, gastos y rendiciones con menos Excel, menos WhatsApp y más confianza."
        />
        <link rel="canonical" href="https://mikurso.cl/" />
        <meta property="og:title" content="Kurso | Menos cobros manuales, más control para tu curso" />
        <meta
          property="og:description"
          content="Ordena la tesorería escolar con control de cuotas, pagos, gastos y rendiciones en una plataforma más seria y clara para apoderados."
        />
        <meta property="og:image" content="https://mikurso.cl/og-image.png" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                name: "Kurso",
                applicationCategory: "FinanceApplication, EducationalApplication",
                operatingSystem: "Web, Android, iOS",
                description:
                  "Plataforma para tesorería escolar, control de cuotas, pagos de apoderados, gastos y rendición de cuentas en Chile.",
              },
              {
                "@type": "FAQPage",
                mainEntity: [
                  {
                    "@type": "Question",
                    name: "¿Por qué pagar si existen herramientas gratis?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Porque el costo real no es solo el precio. También importa cuánto tiempo consume la cobranza manual, cuántos errores se producen y qué tan ordenada queda la operación.",
                    },
                  },
                ],
              },
            ],
          })}
        </script>
      </Helmet>

      <nav className="fixed z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <img src={branding.logoUrl} alt={branding.appName} className="mt-2 h-[60px] w-auto object-contain" />
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button variant="ghost" onClick={() => navigate("/auth")}>Ingresar</Button>
            <Button onClick={() => navigate("/auth?mode=signup")}>Comenzar prueba gratis</Button>
          </div>
        </div>
      </nav>

      <section className="relative pb-24 pt-32 lg:pt-44">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-primary/15 blur-[110px]" />
          <div className="absolute bottom-0 right-0 h-[420px] w-[680px] rounded-full bg-emerald-500/10 blur-[110px]" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-center">
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Tesorería escolar con menos Excel, menos WhatsApp y más control
            </span>
            <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
              Deja de perseguir pagos.
              <br />
              <span className="bg-gradient-to-r from-primary via-emerald-500 to-sky-500 bg-clip-text text-transparent">
                Empieza a gestionar de verdad.
              </span>
            </h1>
            <p className="mx-auto max-w-3xl text-xl text-muted-foreground">
              Kurso ayuda a cursos y centros de padres a controlar cuotas, pagos de apoderados, gastos y rendiciones con una operación más clara y menos dependiente del tesorero.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <MercadoPagoBadge />
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                Sin cobros automáticos
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-sm font-medium text-slate-700">
                <CheckCircle2 className="h-4 w-4" />
                Transparencia para apoderados
              </span>
            </div>
            <div className="mx-auto max-w-5xl rounded-3xl border border-sky-200 bg-white/85 p-6 shadow-xl shadow-sky-100/60 backdrop-blur">
              <div className="grid gap-4 md:grid-cols-3">
                <PricingStep eyebrow="Paso 1" title="7 días gratis" description="Prueba completa para ordenar el flujo de tu curso." />
                <PricingStep eyebrow="Paso 2" title={formatCurrencyCLP(SAAS_PRICING.introAmount)} description="Después activas tu curso por $5.000 el primer mes." highlight />
                <PricingStep eyebrow="Paso 3" title={`${formatCurrencyCLP(SAAS_PRICING.standardAmount)}/mes`} description="Desde la segunda renovación, pago manual y sin tarjeta guardada." />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1"><CreditCard className="h-4 w-4 text-[#009EE3]" /> Activas con Mercado Pago</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Renovación manual</span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 pt-4 sm:flex-row">
              <Button size="lg" className="h-12 rounded-full px-8 text-lg" onClick={() => navigate("/auth?mode=signup")}>
                Empieza tus 7 días gratis <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-full px-8 text-lg" onClick={() => document.getElementById("comparison")?.scrollIntoView({ behavior: "smooth" })}>
                Ver por qué pagar
              </Button>
            </div>
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-3xl border border-border/60 bg-background/70 p-5 backdrop-blur sm:flex-row sm:justify-center">
              <Button size="lg" variant="secondary" className="w-full rounded-full sm:w-auto" asChild>
                <a href="/downloads/kurso-android.apk" download><Download className="mr-2 h-5 w-5" /> Instalar en Android</a>
              </Button>
              <Button size="lg" variant="outline" className="w-full rounded-full sm:w-auto" onClick={() => setShowIosInstallHelp(true)}>
                <Smartphone className="mr-2 h-5 w-5" /> Instalar en iPhone
              </Button>
              <p className="text-center text-sm text-muted-foreground sm:max-w-sm sm:text-left">
                {isStandalone ? "Kurso ya está instalado en este dispositivo." : "Descarga la app en Android o revisa la guía rápida para instalarla en iPhone."}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-muted/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Lo que Kurso ordena en el día a día</h2>
            <p className="mt-4 text-lg text-muted-foreground">No solo muestra balances. Ayuda a bajar la carga operativa del tesorero y a dar más claridad a los apoderados.</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <FeatureCard icon={<Wallet className="h-8 w-8 text-primary" />} title="Control de cuotas y deuda" description="Sigue pagos por alumno, identifica pendientes y evita reconstruir la información cada semana." />
            <FeatureCard icon={<Bell className="h-8 w-8 text-emerald-500" />} title="Menos cobranza manual" description="Reduce la dependencia del WhatsApp y de recordatorios improvisados para perseguir pagos." />
            <FeatureCard icon={<LineChart className="h-8 w-8 text-sky-500" />} title="Rendición con respaldo" description="Llega a reuniones con movimientos más claros y menos improvisación." />
          </div>
        </div>
      </section>

      <section id="comparison" className="py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">Gratis vs profesional</span>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Por qué pagar si existe algo gratis</h2>
            <p className="text-lg leading-8 text-muted-foreground">
              Una herramienta gratis puede servir para empezar. El punto es cuánto trabajo invisible le deja encima a la directiva y cuánta continuidad entrega cuando la operación se vuelve real.
            </p>
            <ul className="space-y-4">
              <ListItem>Gratis sirve para arrancar. Profesional sirve para ordenar y sostener.</ListItem>
              <ListItem>El costo real no es solo el precio: también es tiempo, desgaste y errores.</ListItem>
              <ListItem>Cuando la tesorería depende de una persona, la continuidad se vuelve frágil.</ListItem>
              <ListItem>Más claridad para apoderados suele significar menos conflicto para la directiva.</ListItem>
            </ul>
          </div>
          <div className="overflow-hidden rounded-3xl border shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-4 py-4 font-semibold">Criterio</th>
                  <th className="px-4 py-4 font-semibold">Gratis / básico</th>
                  <th className="px-4 py-4 font-semibold">Kurso</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Cobranza" left="Mucho seguimiento manual del tesorero." right="Menos dependencia de chats y cobros uno a uno." />
                <ComparisonRow label="Rendición" left="Se arma antes de la reunión." right="Se construye con movimientos y respaldos ordenados." />
                <ComparisonRow label="Continuidad" left="Puede depender demasiado de una persona." right="El historial sigue dentro del curso." />
                <ComparisonRow label="Confianza" left="Se gana a punta de explicaciones." right="Se apoya en información más clara y consistente." />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-primary/5 py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Señales de confianza que sí importan</h2>
            <p className="text-lg leading-8 text-muted-foreground">
              Si vas a pagar por una plataforma, el criterio no debería ser solo “tiene funciones”. También importa si te ayuda a operar mejor, rendir cuentas con más seriedad y no depender de una planilla personal.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TrustCard icon={<Users className="h-5 w-5" />} title="Transparencia para apoderados" description="Menos preguntas repetidas y mejor visibilidad del estado del curso." />
              <TrustCard icon={<ShieldCheck className="h-5 w-5" />} title="Respaldo de la operación" description="Pagos, gastos y movimientos quedan más centralizados." />
              <TrustCard icon={<MessageCircle className="h-5 w-5" />} title="Soporte y onboarding" description="Canal claro para dudas y puesta en marcha." />
              <TrustCard icon={<Building2 className="h-5 w-5" />} title="Escala para colegio o CEPA" description="Kurso no se queda solo en el caso mínimo del curso." />
            </div>
          </div>
          <div className="rounded-3xl border bg-background p-8 shadow-sm">
            <h3 className="text-2xl font-bold tracking-tight">Páginas para intención alta</h3>
            <p className="mt-3 leading-7 text-muted-foreground">Estas páginas responden búsquedas específicas y también sirven como rutas reales para usuarios comparando opciones.</p>
            <div className="mt-6 grid gap-3">
              {SEO_LINKS.map((link) => (
                <Link key={link.path} to={link.path} className="rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/30 hover:bg-primary/5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold tracking-tight">{link.title}</span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-12 rounded-3xl border border-primary/10 bg-primary/5 p-8 md:flex-row md:p-16">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Convenios para establecimientos y centros de padres</h2>
              <p className="text-lg text-muted-foreground">
                Si tu desafío no es solo un curso, Kurso puede ayudarte a ordenar una operación más amplia con mejor trazabilidad y una experiencia más profesional para la comunidad escolar.
              </p>
              <ul className="space-y-3">
                <ListItem>Flujo más serio para cursos y organizaciones escolares.</ListItem>
                <ListItem>Visibilidad financiera más clara para directivas y apoderados.</ListItem>
                <ListItem>Soporte comercial directo para evaluar implementación.</ListItem>
              </ul>
              <div className="flex flex-col gap-4 pt-4 sm:flex-row">
                <Button size="lg" className="bg-green-600 text-white hover:bg-green-700" onClick={() => window.open("https://wa.me/56954031472", "_blank")}>
                  <span className="mr-2">🟢</span>
                  WhatsApp Ventas
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/servicios/gestion-centros-de-padres")}>
                  Ver solución institucional
                </Button>
              </div>
            </div>
            <div className="flex flex-1 justify-center">
              <img src={branding.iconUrl} alt={branding.appName} className="h-48 w-48 object-contain drop-shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Guías para búsquedas long-tail</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Contenido orientado a problemas reales de tesorería de curso y búsquedas comparativas con intención alta.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {GUIDE_LINKS.map((guide) => (
              <Link key={guide.path} to={guide.path} className="rounded-3xl border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-primary/5">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Guía</p>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{guide.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 flex items-center justify-center gap-3 text-center text-3xl font-bold">
            <HelpCircle className="h-8 w-8 text-primary" />
            Preguntas frecuentes
          </h2>
          <div className="space-y-6">
            <FAQItem question="¿Por qué pagar si hay herramientas gratis?" answer="Porque el costo real no es solo el precio. También importa cuánto trabajo manual sigue recayendo en la directiva y qué tan ordenada queda la operación." />
            <FAQItem question="¿Kurso ayuda a reducir Excel y WhatsApp?" answer="Sí. Parte del valor de Kurso es sacar la operación financiera de planillas eternas y chats que mezclan comunicación con trabajo administrativo." />
            <FAQItem question="¿Qué pasa si cambia el tesorero?" answer="La información no debería quedar atrapada en un archivo o en el teléfono personal de alguien. Kurso ayuda a que el historial siga dentro del curso." />
            <FAQItem question="¿Se puede usar desde el celular?" answer="Sí. Kurso funciona como aplicación web y puede instalarse en Android e iPhone." />
          </div>
        </div>
      </section>

      <footer className="border-t bg-background py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex w-full flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <img src={branding.iconUrl} alt={branding.appName} className="h-6 w-6 object-contain grayscale opacity-50" />
              <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Kurso. Todos los derechos reservados.</span>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.open("https://wa.me/56954031472", "_blank")}>
              Contacto y Soporte
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link to="/soporte" className="transition-colors hover:text-primary">Soporte</Link>
            <Link to="/blog" className="transition-colors hover:text-primary">Blog</Link>
            <Link to="/privacidad" className="transition-colors hover:text-primary">Privacidad</Link>
          </div>
        </div>
      </footer>

      {showIosInstallHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-3xl border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Instalar en iPhone</h3>
                <p className="mt-2 text-sm text-muted-foreground">Apple no permite forzar la instalación con un solo botón. Haz esto desde Safari:</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowIosInstallHelp(false)}>Cerrar</Button>
            </div>
            <ol className="mt-5 space-y-3 text-sm text-foreground">
              <li>1. Abre `mikurso.cl` en Safari.</li>
              <li>2. Toca el botón Compartir.</li>
              <li>3. Elige `Agregar a pantalla de inicio`.</li>
              <li>4. Confirma con `Agregar`.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: ReactNode; title: string; description: string }) => (
  <motion.div whileHover={{ y: -5 }} className="space-y-4 rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md">
    <div className="w-fit rounded-xl bg-secondary p-3">{icon}</div>
    <h3 className="text-xl font-bold tracking-tight">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
  </motion.div>
);

const TrustCard = ({ icon, title, description }: { icon: ReactNode; title: string; description: string }) => (
  <div className="rounded-2xl border bg-card p-5">
    <div className="flex items-center gap-2 text-primary">
      {icon}
      <h3 className="font-semibold tracking-tight text-foreground">{title}</h3>
    </div>
    <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
  </div>
);

const PricingStep = ({ eyebrow, title, description, highlight = false }: { eyebrow: string; title: string; description: string; highlight?: boolean }) => (
  <div className={`rounded-2xl border p-5 text-left ${highlight ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-slate-50/60"}`}>
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
    <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
  </div>
);

const FAQItem = ({ question, answer }: { question: string; answer: string }) => (
  <div className="rounded-xl border bg-card/50 p-6 transition-colors hover:bg-card">
    <h4 className="mb-2 text-lg font-bold text-foreground">{question}</h4>
    <p className="text-sm leading-relaxed text-muted-foreground">{answer}</p>
  </div>
);

const ListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex items-start gap-3">
    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
    <span className="text-sm leading-7">{children}</span>
  </li>
);

const ComparisonRow = ({ label, left, right }: { label: string; left: string; right: string }) => (
  <tr className="border-t align-top">
    <td className="px-4 py-4 font-medium text-foreground">{label}</td>
    <td className="px-4 py-4 leading-7 text-muted-foreground">{left}</td>
    <td className="px-4 py-4 leading-7 text-muted-foreground">{right}</td>
  </tr>
);

export default Landing;
