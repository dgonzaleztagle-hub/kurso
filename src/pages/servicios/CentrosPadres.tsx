import { ServiceLayout } from "@/components/layouts/ServiceLayout";
import { Helmet } from "react-helmet-async";
import { Building2, PieChart, Users, FileText } from "lucide-react";

const CentrosPadresPage = () => {
    return (
        <ServiceLayout 
            title="Gestión Digital para Centros de Padres y Apoderados (CEPA)"
            subtitle="Profesionaliza tu organización escolar. Centraliza la recaudación de todo el colegio, gestiona convenios y entrega balances auditables en segundos."
            icon={Building2}
            colorClass="bg-purple-500/10 text-purple-500"
        >
            <Helmet>
                <title>Gestión Centros de Padres Chile (CEPA) | Software Kurso</title>
                <meta name="description" content="La plataforma más robusta para directivas de Centros de Padres en Chile. Control total de aportes voluntarios, gestión de socios y transparencia financiera institucional." />
                <link rel="canonical" href="https://mikurso.cl/servicios/gestion-centros-de-padres" />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        "name": "Gestión para Centros de Padres",
                        "provider": {
                            "@type": "Organization",
                            "name": "Kurso"
                        },
                        "description": "Sistema de administración masiva para organizaciones de padres y apoderados.",
                        "areaServed": "CL"
                    })}
                </script>
            </Helmet>

            <section className="space-y-8">
                <div className="prose prose-lg dark:prose-invert max-w-none">
                    <h2>Escalabilidad y Orden para Directivas CEPA</h2>
                    <p>
                        Gestionar un Centro de Padres implica manejar grandes volúmenes de datos, aportes voluntarios y 
                        una comunicación constante con cientos o miles de familias. Kurso ofrece la infraestructura digital 
                        necesaria para que la directiva se enfoque en lo importante: <strong>el bienestar de la comunidad escolar.</strong>
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-6 not-prose my-12">
                        <div className="p-6 rounded-2xl bg-muted/50 border space-y-3">
                            <PieChart className="h-6 w-6 text-primary" />
                            <h3 className="font-bold">Balances Consolidados</h3>
                            <p className="text-sm text-muted-foreground">Vista global de la salud financiera de todos los cursos y el fondo general del CEPA.</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-muted/50 border space-y-3">
                            <Users className="h-6 w-6 text-blue-500" />
                            <h3 className="font-bold">Gestión de Socios</h3>
                            <p className="text-sm text-muted-foreground">Base de datos centralizada de apoderados, con historial de aportes y participación en actividades.</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-muted/50 border space-y-3">
                            <FileText className="h-6 w-6 text-green-500" />
                            <h3 className="font-bold">Certificados y Actas</h3>
                            <p className="text-sm text-muted-foreground">Digitaliza y resguarda la documentación legal del centro de padres de forma segura.</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-muted/50 border space-y-3">
                            <Building2 className="h-6 w-6 text-pink-500" />
                            <h3 className="font-bold">Perfil Institucional</h3>
                            <p className="text-sm text-muted-foreground">Panel administrativo diseñado para presidentes y secretarios de organizaciones con personalidad jurídica.</p>
                        </div>
                    </div>

                    <h2>Transparencia Radical = Confianza de Apoderados</h2>
                    <p>
                        La mayor barrera para los Centros de Padres es la desconfianza sobre el uso de los fondos. 
                        Con Kurso, cada apoderado tiene acceso a un portal de transparencia donde puede auditar los movimientos 
                        según su nivel de permiso, fortaleciendo el vínculo comunidad-escuela.
                    </p>
                </div>
                
                <div className="bg-purple-500/5 p-8 rounded-3xl border border-purple-500/10 text-center space-y-4">
                    <h3 className="text-2xl font-bold">Profesionaliza tu directiva hoy</h3>
                    <p className="text-muted-foreground">Agenda una consultoría gratuita para implementar Kurso en tu establecimiento.</p>
                    <button className="bg-purple-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-purple-700 transition-all">
                        Contactar Especialista Kurso
                    </button>
                </div>
            </section>
        </ServiceLayout>
    );
};

export default CentrosPadresPage;
