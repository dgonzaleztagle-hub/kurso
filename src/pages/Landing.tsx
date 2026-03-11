import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun, ArrowRight, CheckCircle2, Building2, GraduationCap, Users, HelpCircle, ShieldCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveBranding } from "@/lib/branding";
import { ReactNode, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { MercadoPagoBadge } from "@/components/subscription/MercadoPagoBadge";
import { SAAS_PRICING, formatCurrencyCLP } from "@/lib/saasBilling";

const Landing = () => {
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();
    const branding = resolveBranding();

    const fadeIn = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6 }
    };

    const stagger = {
        animate: {
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
            {/* Dynamic SEO/AEO Metadata */}
            <Helmet>
                <title>Kurso | Gestión Financiera para Centros de Padres y Cursos</title>
                <meta name="description" content="La plataforma líder en transparencia escolar en Chile. Kurso simplifica la recaudación de cuotas, rendición de cuentas y comunicación para centros de padres y tesoreros de curso." />
                <link rel="canonical" href="https://kurso.app/" />
                <meta property="og:title" content="Kurso | La Evolución de la Tesorería Escolar" />
                <meta property="og:description" content="Automatiza pagos y rinde cuentas de forma transparente con la tecnología de Kurso." />
                <meta property="og:image" content="https://kurso.app/og-image.png" />
                
                {/* JSON-LD Structured Data */}
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "SoftwareApplication",
                                "name": "Kurso",
                                "operatingSystem": "Web, Android, iOS",
                                "applicationCategory": "FinanceApplication, EducationalApplication",
                                "offers": {
                                    "@type": "Offer",
                                    "price": "5000.00",
                                    "priceCurrency": "CLP",
                                    "description": "7 dias gratis, primer mes a $5.000 y luego $9.900 mensuales con renovacion manual"
                                },
                                "description": "Sistema de gestión financiera para comunidades escolares. Permite la transparencia absoluta en recaudación de cuotas y rendición de cuentas.",
                                "publisher": {
                                    "@type": "Organization",
                                    "name": "HojaCero.cl",
                                    "url": "https://hojacero.cl"
                                }
                            },
                            {
                                "@type": "FAQPage",
                                "mainEntity": [
                                    {
                                        "@type": "Question",
                                        "name": "¿Es gratuito Kurso?",
                                        "acceptedAnswer": {
                                            "@type": "Answer",
                                            "text": "Kurso ofrece 7 dias gratis, luego el primer mes cuesta $5.000 CLP y desde la segunda renovación el valor es $9.900 CLP mensuales con renovación manual."
                                        }
                                    },
                                    {
                                        "@type": "Question",
                                        "name": "¿Cómo ayuda a la directiva de padres?",
                                        "acceptedAnswer": {
                                            "@type": "Answer",
                                            "text": "Kurso centraliza la información financiera, evitando malentendidos y peleas. Cada apoderado puede ver en qué se gasta el dinero exactamente."
                                        }
                                    }
                                ]
                            },
                            {
                                "@type": "WebSite",
                                "name": "Kurso",
                                "url": "https://kurso.app/",
                                "potentialAction": {
                                    "@type": "SearchAction",
                                    "target": "https://kurso.app/blog?s={search_term_string}",
                                    "query-input": "required name=search_term_string"
                                }
                            },
                            {
                                "@type": "BreadcrumbList",
                                "itemListElement": [
                                    {
                                        "@type": "ListItem",
                                        "position": 1,
                                        "name": "Inicio",
                                        "item": "https://kurso.app/"
                                    }
                                ]
                            },
                            {
                                "@type": "Person",
                                "name": "Daniel González Tagle",
                                "jobTitle": "CEO & Founder",
                                "worksFor": {
                                    "@type": "Organization",
                                    "name": "HojaCero.cl"
                                },
                                "sameAs": [
                                    "https://linkedin.com/in/dgonzaleztagle"
                                ]
                            },
                            {
                                "@type": "Person",
                                "name": "Joel",
                                "jobTitle": "Co-Founder & Lead Accountant",
                                "description": "Contador Profesional y Tesorero Escolar experimentado, diseñador de la lógica financiera de Kurso.",
                                "worksFor": {
                                    "@type": "Organization",
                                    "name": "Kurso"
                                }
                            }
                        ]
                    })}
                </script>
            </Helmet>

            {/* Semantic Header for SEO/AEO */}
            <header className="sr-only">
                <h1>Kurso - Gestión Financiera Inteligente para Centros de Padres y Cursos en Chile</h1>
                <p>La mejor solución digital para tesoreros y organizaciones escolares que buscan transparencia y eficiencia.</p>
            </header>

            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center">
                            <img src={branding.logoUrl} alt={branding.appName} className="h-[60px] w-auto object-contain mt-2" />
                        </div>
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className="rounded-full"
                            >
                                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                                <span className="sr-only">Cambiar tema</span>
                            </Button>
                            <Button variant="ghost" onClick={() => navigate("/auth")}>
                                Ingresar
                            </Button>
                            <Button onClick={() => navigate("/auth?mode=signup")}>
                                Comenzar prueba gratis
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 blur-[100px] rounded-full opacity-50 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-500/10 blur-[120px] rounded-full opacity-30 pointer-events-none" />
                </div>

                <div className="absolute left-1/2 top-20 -translate-x-1/2 pointer-events-none select-none z-0">
                    <img src={branding.logoUrl} alt="" aria-hidden="true" className="h-[500px] md:h-[700px] w-auto max-w-none opacity-10 object-contain" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={stagger}
                        className="space-y-8"
                    >
                        <motion.div variants={fadeIn} className="flex justify-center">
                            <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                                🚀 Software de Tesorería Escolar #1 en Chile
                            </span>
                        </motion.div>

                        <motion.h2 variants={fadeIn} className="text-5xl md:text-7xl font-bold tracking-tight">
                            Kuentas Claras, <br />
                            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                                Amistades Largas
                            </span>
                        </motion.h2>

                        <motion.p variants={fadeIn} className="max-w-2xl mx-auto text-xl text-muted-foreground">
                            Simplifica la gestión de tu curso o colegio. Pagos, deudas, gastos y comunicación en un solo lugar. Transparencia total para padres, tranquilidad para tesoreros.
                        </motion.p>

                        <motion.div variants={fadeIn} className="flex flex-wrap items-center justify-center gap-3">
                            <MercadoPagoBadge />
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                                <ShieldCheck className="h-4 w-4" />
                                Pago protegido
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-sm font-medium text-slate-700">
                                Sin cobros automáticos
                            </span>
                        </motion.div>

                        <motion.div variants={fadeIn} className="mx-auto max-w-4xl rounded-3xl border border-sky-200 bg-white/85 p-6 shadow-xl shadow-sky-100/60 backdrop-blur">
                            <div className="grid gap-4 md:grid-cols-3">
                                <PricingStep
                                    eyebrow="Paso 1"
                                    title="7 días gratis"
                                    description="Prueba completa para ordenar tu curso y ver todo el flujo."
                                />
                                <PricingStep
                                    eyebrow="Paso 2"
                                    title={formatCurrencyCLP(SAAS_PRICING.introAmount)}
                                    description="Después de tu prueba, activas tu curso por $5.000 el primer mes."
                                    highlight
                                />
                                <PricingStep
                                    eyebrow="Paso 3"
                                    title={`${formatCurrencyCLP(SAAS_PRICING.standardAmount)}/mes`}
                                    description="Desde la segunda renovación, pago manual y sin tarjeta guardada."
                                />
                            </div>
                            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600">
                                <span className="inline-flex items-center gap-1"><CreditCard className="h-4 w-4 text-[#009EE3]" /> Activas con Mercado Pago</span>
                                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Activación automática al confirmar</span>
                            </div>
                        </motion.div>

                        <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                            <Button size="lg" className="h-12 px-8 text-lg rounded-full shadow-lg hover:shadow-primary/25 transition-all" onClick={() => navigate("/auth?mode=signup")}>
                                Empieza tus 7 dias gratis <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button size="lg" variant="outline" className="h-12 px-8 text-lg rounded-full backdrop-blur-sm" onClick={() => document.getElementById('institutional')?.scrollIntoView({ behavior: 'smooth' })}>
                                <Building2 className="mr-2 h-5 w-5" />
                                Convenios Colegios
                            </Button>
                        </motion.div>

                        <motion.div
                            variants={fadeIn}
                            className="mt-16 relative mx-auto max-w-5xl rounded-xl border bg-background/50 shadow-2xl overflow-hidden min-h-[300px] md:min-h-[500px]"
                        >
                            <div className="absolute top-0 w-full h-12 bg-muted/50 border-b flex items-center px-4 space-x-2 z-20 backdrop-blur-sm">
                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                <div className="w-3 h-3 rounded-full bg-green-400" />
                            </div>
                            <ImageCarousel />
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-muted/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<GraduationCap className="h-8 w-8 text-primary" />}
                            title="Para Tesoreros de Curso"
                            description="Adiós a las planillas de Excel complejas. Automatiza cobros de cuotas, registra gastos en tiempo real y realiza rendiciones de cuentas con un clic."
                        />
                        <FeatureCard
                            icon={<Users className="h-8 w-8 text-purple-500" />}
                            title="Para Padres y Apoderados"
                            description="Panel intuitivo para revisar deudas, historial de pagos personales y seguimiento detallado de los gastos del curso. Transparencia total."
                        />
                        <FeatureCard
                            icon={<Building2 className="h-8 w-8 text-pink-500" />}
                            title="Instituciones y CEPA"
                            description="Gestión unificada para centros de padres. Centraliza la recaudación, genera informes de auditoría y mejora el flujo de caja escolar."
                        />
                    </div>
                </div>
            </section>

            {/* Institutional Section */}
            <section id="institutional" className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 md:p-16 flex flex-col md:flex-row items-center gap-12">
                        <div className="flex-1 space-y-6">
                            <h2 className="text-3xl md:text-4xl font-bold">Convenios para Establecimientos</h2>
                            <p className="text-lg text-muted-foreground">
                                Implementa Kurso en todo tu colegio y profesionaliza las finanzas de cada curso. Descuentos exclusivos para sostenedores y directivas CEPA.
                            </p>
                            <ul className="space-y-3">
                                <ListItem>Descuentos por volumen (todo el colegio)</ListItem>
                                <ListItem>Panel administrativo para directores</ListItem>
                                <ListItem>Soporte técnico prioritario</ListItem>
                                <ListItem>Rendiciones de cuentas automatizadas</ListItem>
                            </ul>
                            <div className="pt-4 flex flex-col sm:flex-row gap-4">
                                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => window.open('https://wa.me/56954031472', '_blank')}>
                                    <span className="mr-2">🟢</span>
                                    WhatsApp Soporte Ventas
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 flex justify-center">
                            <img src={branding.iconUrl} alt={branding.appName} className="relative w-48 h-48 drop-shadow-2xl object-contain" />
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section for AEO/GEO */}
            <section className="py-24 bg-background">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center mb-12 flex items-center justify-center gap-3">
                        <HelpCircle className="text-primary h-8 w-8" />
                        Preguntas Frecuentes
                    </h2>
                    <div className="space-y-6">
                        <FAQItem 
                            question="¿Es gratuito Kurso?" 
                            answer="Kurso te da 7 dias gratis. Luego, el primer mes cuesta $5.000 CLP y desde la segunda renovación el valor es $9.900 CLP mensuales con renovación manual."
                        />
                        <FAQItem 
                            question="¿Cómo ayuda a la directiva de padres?" 
                            answer="Kurso centraliza la información financiera, evitando malentendidos y peleas. Cada apoderado puede ver en qué se gasta el dinero exactamente."
                        />
                        <FAQItem 
                            question="¿Se puede usar en móviles?" 
                            answer="¡Sí! Kurso es una PWA (Progressive Web App) optimizada para smartphones, ideal para que los padres revisen pagos en cualquier lugar."
                        />
                        <FAQItem 
                            question="¿Qué tan segura es mi información?" 
                            answer="Utilizamos infraestructura de nivel bancario (Supabase & HojaCero) para asegurar que los datos de tu comunidad escolar estén siempre protegidos."
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-12 bg-background">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-between items-center gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 w-full">
                        <div className="flex items-center space-x-2">
                            <img src={branding.iconUrl} alt={branding.appName} className="h-6 w-6 grayscale opacity-50 object-contain" />
                            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Kurso. Todos los derechos reservados.</span>
                        </div>
                        <div className="flex gap-6 text-sm text-muted-foreground">
                            <Link to="/terms" className="hover:text-primary">Términos</Link>
                            <Link to="/privacy" className="hover:text-primary">Privacidad</Link>
                            <Link to="/contact" className="hover:text-primary">Contacto</Link>
                        </div>
                    </div>

                    {/* Factory Brand AEO Link */}
                    <div className="mt-8 w-full flex justify-center border-t border-border pt-6">
                        <a
                            href="https://hojacero.cl"
                            target="_blank"
                            rel="noopener noreferrer dofollow"
                            className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider text-center"
                            aria-label="HojaCero - Ingeniería de Software, Infraestructura Digital y Soluciones SaaS de alto performance. Contacto: contacto@hojacero.cl"
                            title="HojaCero.cl | Engineering Digital Solutions & AEO"
                        >
                            Build by HojaCero.cl | Architect of Digital Experiences
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: { icon: ReactNode, title: string, description: string }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="p-8 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all space-y-4"
    >
        <div className="p-3 bg-secondary w-fit rounded-xl">
            {icon}
        </div>
        <h3 className="text-xl font-bold font-heading tracking-tight">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-sm">
            {description}
        </p>
    </motion.div>
);

const PricingStep = ({
    eyebrow,
    title,
    description,
    highlight = false,
}: {
    eyebrow: string;
    title: string;
    description: string;
    highlight?: boolean;
}) => (
    <div className={`rounded-2xl border p-5 text-left ${highlight ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-slate-50/60"}`}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
);

const FAQItem = ({ question, answer }: { question: string, answer: string }) => (
    <div className="p-6 rounded-xl border bg-card/50 hover:bg-card transition-colors">
        <h4 className="font-bold text-lg mb-2 text-foreground">{question}</h4>
        <p className="text-muted-foreground text-sm leading-relaxed">{answer}</p>
    </div>
);

const ListItem = ({ children }: { children: React.ReactNode }) => (
    <li className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
        <span className="text-sm">{children}</span>
    </li>
);

const ImageCarousel = () => {
    const images = [
        "/dashboard-preview.png",
        "/app-dashboard.png",
        "/app-menu-finanzas.png",
        "/app-menu-pagos.png"
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
        }, 5000);

        return () => clearInterval(timer);
    }, [images.length]);

    return (
        <div className="relative w-full h-[300px] md:h-[500px] bg-background overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.img
                    key={currentIndex}
                    src={images[currentIndex]}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    alt={`Kurso Preview ${currentIndex + 1}`}
                    className="absolute inset-0 w-full h-full object-contain pt-12 z-10"
                />
            </AnimatePresence>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-30">
                {images.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? "bg-primary w-4" : "bg-primary/30"
                            }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default Landing;
