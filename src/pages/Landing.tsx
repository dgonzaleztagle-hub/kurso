import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun, ArrowRight, CheckCircle2, Building2, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const Landing = () => {
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();

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
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center">
                            {/* Full Logo for perfect alignment - increased size */}
                            <img src="/kurso-logo-full.png" alt="Kurso" className="h-[60px] w-auto object-contain mt-2" />
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
                                <span className="sr-only">Toggle theme</span>
                            </Button>
                            <Button variant="ghost" onClick={() => navigate("/auth")}>
                                Ingresar
                            </Button>
                            <Button onClick={() => navigate("/auth?mode=signup")}>
                                Comenzar Gratis
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    {/* Gradient Blobs (Background Layer) */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 blur-[100px] rounded-full opacity-50 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-500/10 blur-[120px] rounded-full opacity-30 pointer-events-none" />
                </div>

                {/* Giant K Watermark */}
                <div className="absolute left-1/2 top-20 -translate-x-1/2 pointer-events-none select-none z-0">
                    <img src="/kurso-icon.png" alt="" className="h-[500px] md:h-[700px] w-auto max-w-none opacity-25" />
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
                                🚀 La nueva forma de gestionar tesorerías escolares
                            </span>
                        </motion.div>

                        <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-bold tracking-tight">
                            Kuentas Claras, <br />
                            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                                Amistades Largas
                            </span>
                        </motion.h1>

                        <motion.p variants={fadeIn} className="max-w-2xl mx-auto text-xl text-muted-foreground">
                            Simplifica la gestión de tu curso o colegio. Pagos, deudas, gastos y comunicación en un solo lugar. Transparencia total para padres, tranquilidad para tesoreros.
                        </motion.p>

                        <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                            <Button size="lg" className="h-12 px-8 text-lg rounded-full shadow-lg hover:shadow-primary/25 transition-all" onClick={() => navigate("/auth?mode=signup")}>
                                Prueba 7 días Gratis <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button size="lg" variant="outline" className="h-12 px-8 text-lg rounded-full backdrop-blur-sm" onClick={() => document.getElementById('institutional')?.scrollIntoView({ behavior: 'smooth' })}>
                                <Building2 className="mr-2 h-5 w-5" />
                                Convenios Colegios
                            </Button>
                        </motion.div>

                        {/* Mockup Preview with Carousel */}
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
                            title="Para Tesoreros"
                            description="Olvídate de las planillas de excel infinitas. Automatiza cobros, registra gastos y rinde cuentas en segundos."
                        />
                        <FeatureCard
                            icon={<Users className="h-8 w-8 text-purple-500" />}
                            title="Para Padres"
                            description="Panel simple para ver qué debes, historiales de pago y transparencia total de en qué se gasta el dinero."
                        />
                        <FeatureCard
                            icon={<Building2 className="h-8 w-8 text-pink-500" />}
                            title="Para Colegios"
                            description="Visión global de todos los cursos. Centraliza la recaudación y mejora la comunicación con los apoderados."
                        />
                    </div>
                </div>
            </section>

            {/* Institutional Section */}
            <section id="institutional" className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 md:p-16 flex flex-col md:flex-row items-center gap-12">
                        <div className="flex-1 space-y-6">
                            <h2 className="text-3xl md:text-4xl font-bold">Convenios Institucionales</h2>
                            <p className="text-lg text-muted-foreground">
                                ¿Eres Sostenedor o Director? Obtén **descuentos exclusivos por volumen** implementando Kurso en todo tu establecimiento.
                            </p>
                            <ul className="space-y-3">
                                <ListItem>Descuentos especiales por cantidad de cursos</ListItem>
                                <ListItem>Dashboard Directivo Unificado</ListItem>
                                <ListItem>Soporte Prioritario por WhatsApp</ListItem>
                                <ListItem>Facturación Centralizada</ListItem>
                            </ul>
                            <div className="pt-4 flex flex-col sm:flex-row gap-4">
                                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => window.open('https://wa.me/56972739105', '_blank')}>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WA" className="w-5 h-5 mr-2 filter brightness-0 invert" />
                                    Solicitar Convenio
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 flex justify-center">
                            <div className="relative w-64 h-64 bg-gradient-to-br from-primary to-purple-600 rounded-full blur-3xl opacity-20 animate-pulse" />
                            <img src="/kurso-icon.png" alt="Institucional" className="relative w-48 h-48 drop-shadow-2xl" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-12 bg-background">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center space-x-2">
                        <img src="/kurso-icon.png" alt="Logo" className="h-6 w-6 grayscale opacity-50" />
                        <span className="text-sm text-muted-foreground">© 2025 Kurso. Todos los derechos reservados.</span>
                    </div>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                        <Link to="/terms" className="hover:text-primary">Términos</Link>
                        <Link to="/privacy" className="hover:text-primary">Privacidad</Link>
                        <Link to="/contact" className="hover:text-primary">Contacto</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: { icon: any, title: string, description: string }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="p-8 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all space-y-4"
    >
        <div className="p-3 bg-secondary w-fit rounded-xl">
            {icon}
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">
            {description}
        </p>
    </motion.div>
);

const ListItem = ({ children }: { children: React.ReactNode }) => (
    <li className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        <span>{children}</span>
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
        }, 5000); // Change every 5 seconds

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-full h-[300px] md:h-[500px] bg-background">
            <AnimatePresence mode="wait">
                <motion.img
                    key={currentIndex}
                    src={images[currentIndex]}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5 }}
                    alt={`Preview ${currentIndex + 1}`}
                    className="absolute inset-0 w-full h-full object-cover md:object-contain pt-12"
                />
            </AnimatePresence>

            {/* Carousel Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-30">
                {images.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? "bg-primary w-4" : "bg-primary/30"
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default Landing;
