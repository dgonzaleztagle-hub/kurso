import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, CheckCircle2, TrendingUp, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveBranding } from "@/lib/branding";

const ImplementacionExitosa = () => {
    const branding = resolveBranding();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Helmet>
                <title>Caso de Éxito: Transparencia Escolar Digital | Kurso</title>
                <meta name="description" content="Descubre cómo las directivas de padres están usando Kurso para digitalizar sus finanzas, eliminar el uso de efectivo y mejorar la confianza de los apoderados." />
                <link rel="canonical" href="https://mikurso.cl/casos/transparencia-total-colegio-chile" />
            </Helmet>

            {/* Navbar Lite */}
            <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Volver al Inicio
                    </Link>
                    <div className="flex items-center gap-2">
                         <img src={branding.iconUrl} alt={branding.appName} className="h-6 w-6 grayscale" />
                    </div>
                </div>
            </nav>

            <article className="max-w-4xl mx-auto px-4 py-12 md:py-20 lg:py-32">
                <header className="space-y-6 text-center mb-16">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-green-500/10 text-green-600 text-xs font-bold uppercase tracking-widest border border-green-500/20">
                        Caso de Éxito #01
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
                        De planillas de Excel al <span className="text-primary italic">Control Total</span> en 30 días.
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Cómo una directiva de curso en Santiago de Chile eliminó los malentendidos financieros y digitalizó la recaudación del curso.
                    </p>
                </header>

                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    <div className="p-6 rounded-2xl border bg-muted/50 text-center space-y-2">
                        <TrendingUp className="h-6 w-6 text-primary mx-auto" />
                        <div className="text-2xl font-bold">100%</div>
                        <div className="text-xs text-muted-foreground uppercase">Transparencia</div>
                    </div>
                    <div className="p-6 rounded-2xl border bg-muted/50 text-center space-y-2">
                        <Clock className="h-6 w-6 text-yellow-500 mx-auto" />
                        <div className="text-2xl font-bold">-5 Horas</div>
                        <div className="text-xs text-muted-foreground uppercase">Ahorro Semanal</div>
                    </div>
                    <div className="p-6 rounded-2xl border bg-muted/50 text-center space-y-2">
                        <ShieldCheck className="h-6 w-6 text-green-500 mx-auto" />
                        <div className="text-2xl font-bold">0 Errores</div>
                        <div className="text-xs text-muted-foreground uppercase">En Auditoría</div>
                    </div>
                </div>

                <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
                    <h2 className="text-3xl font-bold tracking-tight">El Origen: Un Contador en Apuros</h2>
                    <p>
                        Joel, contador de profesión y tesorero de su propio curso, se enfrentó al mismo problema que miles de apoderados en Chile: la gestión financiera escolar era un caos de mensajes de WhatsApp, transferencias sin identificar y planillas de Excel que solo él entendía.
                    </p>
                    <p>
                        <strong>"Como contador, sabía que el orden era posible, pero como tesorero de curso, simplemente no tenía las herramientas adecuadas,"</strong> explica Joel. Así nace Kurso, una plataforma diseñada por un experto en finanzas para personas que no lo son.
                    </p>

                    <h2 className="text-3xl font-bold tracking-tight">La Implementación</h2>
                    <p>
                        El curso piloto decidió abandonar el efectivo y las libretas de notas. Se cargó la lista de 45 alumnos y se automatizaron las cuotas mensuales de la gira de estudios.
                    </p>
                    <div className="bg-primary/5 border-l-4 border-primary p-6 my-8 rounded-r-xl italic">
                        "La diferencia fue inmediata. Al ser contador, pude inyectar en Kurso toda la lógica de auditoría necesaria para que no se pierda ni un peso, pero con una interfaz que hasta mi abuela puede usar." - Joel, Fundador y Tesorero.
                    </div>

                    <h2 className="text-3xl font-bold tracking-tight">Los Resultados</h2>
                    <p>
                        Tras un mes de uso, la confianza de la comunidad aumentó drásticamente. Los apoderados ahora pueden revisar desde su propio celular cuánto dinero hay en caja y en qué se ha gastado, sin necesidad de pedir explicaciones adicionales.
                    </p>
                    <div className="not-prose grid gap-4 mb-12">
                        <div className="flex items-center gap-3 p-4 rounded-xl border bg-card shadow-sm">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="font-medium">Digitalización del 100% de la recaudación.</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 rounded-xl border bg-card shadow-sm">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="font-medium">Acceso inmediato para los 45 apoderados del curso.</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 rounded-xl border bg-card shadow-sm">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="font-medium">Reducción del estrés del cargo de tesorería.</span>
                        </div>
                    </div>
                </div>

                <footer className="mt-20 pt-12 border-t text-center space-y-8">
                    <div className="max-w-md mx-auto space-y-4">
                        <h3 className="text-2xl font-bold">¿Quieres lograr esto en tu curso?</h3>
                        <p className="text-muted-foreground">
                            Únete a las comunidades escolares que ya son transparentes gracias a la tecnología de HojaCero.
                        </p>
                        <Button size="lg" className="rounded-full w-full shadow-lg" onClick={() => navigate("/auth?mode=signup")}>
                            Empieza hoy tu prueba gratis
                        </Button>
                    </div>
                </footer>
            </article>
        </div>
    );
};

export default ImplementacionExitosa;
