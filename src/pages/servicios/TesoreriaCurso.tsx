import { ServiceLayout } from "@/components/layouts/ServiceLayout";
import { Helmet } from "react-helmet-async";
import { GraduationCap, Wallet, ShieldCheck, Zap } from "lucide-react";

const TesoreriaCursoPage = () => {
    return (
        <ServiceLayout 
            title="Software para Tesoreros de Curso en Chile"
            subtitle="Olvídate del Excel y las peleas por el dinero. Kurso automatiza el cobro de cuotas y la rendición de cuentas para que tu curso sea 100% transparente."
            icon={GraduationCap}
            colorClass="bg-blue-500/10 text-blue-500"
        >
            <Helmet>
                <title>Software para Tesoreros de Curso Chile | Kurso</title>
                <meta name="description" content="La herramienta definitiva para el tesorero de curso. Administra pagos, rinde gastos y mantén a los apoderados informados en tiempo real. ¡Adiós a las planillas de Excel!" />
                <link rel="canonical" href="https://mikurso.cl/servicios/tesoreria-de-curso" />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        "name": "Software para Tesoreros de Curso",
                        "provider": {
                            "@type": "Organization",
                            "name": "Kurso"
                        },
                        "description": "Automatización de cobros y rendición de cuentas para tesoreros de colegios.",
                        "areaServed": "CL",
                        "hasOfferCatalog": {
                            "@type": "OfferCatalog",
                            "name": "Servicios para Cursos",
                            "itemListElement": [
                                {
                                    "@type": "Offer",
                                    "itemOffered": {
                                        "@type": "Service",
                                        "name": "Gestión de Cuotas de Curso"
                                    }
                                }
                            ]
                        }
                    })}
                </script>
            </Helmet>

            <section className="space-y-8">
                <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h2>¿Por qué seguir sufriendo con planillas de Excel?</h2>
                    <p>
                        Ser tesorero de curso es una tarea noble pero ingrata. Recibir transferencias a tu cuenta personal, 
                        perder el rastro de quién pagó y enfrentar cuestionamientos por los gastos es cosa del pasado. 
                        <strong>Kurso nace para profesionalizar la tesorería escolar chilena.</strong>
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-6 not-prose my-12">
                        <div className="p-6 rounded-2xl bg-muted/50 border space-y-3">
                            <Wallet className="h-6 w-6 text-primary" />
                            <h3 className="font-bold">Control de Pagos</h3>
                            <p className="text-sm text-muted-foreground">Registra cuotas mensuales, paseos o rifas en segundos. Cada apoderado recibe su comprobante digital.</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-muted/50 border space-y-3">
                            <Zap className="h-6 w-6 text-yellow-500" />
                            <h3 className="font-bold">Rendición Instantánea</h3>
                            <p className="text-sm text-muted-foreground">Sube tus boletas y Kurso genera un balance automático. Transparencia total sin mover un dedo.</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-muted/50 border space-y-3">
                            <ShieldCheck className="h-6 w-6 text-green-500" />
                            <h3 className="font-bold">Seguridad de Datos</h3>
                            <p className="text-sm text-muted-foreground">La información de tus alumnos y apoderados está protegida bajo estándares bancarios.</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-muted/50 border space-y-3">
                            <GraduationCap className="h-6 w-6 text-purple-500" />
                            <h3 className="font-bold">Adaptado a Chile</h3>
                            <p className="text-sm text-muted-foreground">Cumple con los estándares requeridos por los centros de padres y directivas de colegios en Chile.</p>
                        </div>
                    </div>

                    <h2>Características que aman los tesoreros:</h2>
                    <ul>
                        <li><strong>Recordatorios de Cobro:</strong> Avisa a los rezagados sin parecer el cobrador del frac.</li>
                        <li><strong>Portal del Apoderado:</strong> Cada padre puede ver su estado de cuenta personal desde el celular.</li>
                        <li><strong>Historial de Gastos:</strong> Adjunta fotos de boletas y mantén el orden contable.</li>
                    </ul>
                </div>
                
                <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 text-center space-y-4">
                    <h3 className="text-2xl font-bold">Únete a la nueva era de la tesorería</h3>
                    <p className="text-muted-foreground">Miles de cursos ya están digitalizando su ahorro. ¿Tu curso se va a quedar atrás?</p>
                    <button className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold shadow-lg hover:bg-primary/90 transition-all">
                        Crea la cuenta de tu curso gratis
                    </button>
                </div>
            </section>
        </ServiceLayout>
    );
};

export default TesoreriaCursoPage;
