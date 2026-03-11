import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { resolveBranding } from "@/lib/branding";

interface ServiceLayoutProps {
    children: ReactNode;
    title: string;
    subtitle: string;
    icon: LucideIcon;
    colorClass: string;
}

export const ServiceLayout = ({ children, title, subtitle, icon: Icon, colorClass }: ServiceLayoutProps) => {
    const branding = resolveBranding();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
            {/* Nav Lite */}
            <nav className="fixed w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link to="/" className="flex items-center gap-2">
                            <img src={branding.iconUrl} alt={branding.appName} className="h-8 w-8 object-contain" />
                            <span className="font-bold tracking-tight">{branding.appName}</span>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Ingresar</Button>
                    </div>
                </div>
            </nav>

            <main className="pt-24 pb-20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Hero Area */}
                    <div className="mb-16 space-y-6">
                        <div className={`p-3 w-fit rounded-2xl ${colorClass} mb-4`}>
                            <Icon className="h-8 w-8" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
                            {title}
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
                            {subtitle}
                        </p>
                        <div className="pt-4 flex flex-wrap gap-4">
                            <Button size="lg" className="rounded-full px-8 shadow-lg" onClick={() => navigate("/auth?mode=signup")}>
                                Probar Gratis Ahora
                            </Button>
                            <Button variant="outline" size="lg" className="rounded-full px-8" onClick={() => window.open('https://wa.me/56954031472', '_blank')}>
                                <MessageCircle className="mr-2 h-5 w-5" />
                                Hablar con Ventas
                            </Button>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="grid lg:grid-cols-12 gap-12">
                        <div className="lg:col-span-8 space-y-12">
                            {children}
                        </div>
                        
                        {/* Sticky Sidebar */}
                        <aside className="lg:col-span-4">
                            <div className="sticky top-24 space-y-6">
                                <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10 space-y-6">
                                    <h3 className="text-xl font-bold">Resumen de Benficios</h3>
                                    <ul className="space-y-4">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span className="text-sm">Rendición automática en 1 clic</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span className="text-sm">Notificaciones de pago automáticas</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span className="text-sm">Historial histórico infinito</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span className="text-sm">Acceso 24/7 para apoderados</span>
                                        </li>
                                    </ul>
                                    <Button className="w-full rounded-2xl h-12" onClick={() => navigate("/auth?mode=signup")}>
                                        Comenzar Ahora
                                    </Button>
                                </div>

                                <div className="p-6 text-center">
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-4 opacity-50">Parte del ecosistema</p>
                                    <img src="https://hojacero.cl/logo.png" alt="HojaCero" className="h-6 mx-auto grayscale opacity-50" />
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
};
