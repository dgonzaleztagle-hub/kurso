import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CreditCard,
  Database,
  Eye,
  LifeBuoy,
  MousePointerClick,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type CoreStats = {
  orgs: number;
  tenants: number;
  users: number;
  billingLogs: number;
  supportTickets: number;
};

type VisitSummary = {
  total_visits: number;
  unique_visitors: number;
  home_visits: number;
  seo_visits: number;
  blog_visits: number;
  visits_last_7_days: number;
};

type TopPage = {
  path: string;
  visits: number;
  unique_visitors: number;
  last_visit: string | null;
};

const EMPTY_SUMMARY: VisitSummary = {
  total_visits: 0,
  unique_visitors: 0,
  home_visits: 0,
  seo_visits: 0,
  blog_visits: 0,
  visits_last_7_days: 0,
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [stats, setStats] = useState<CoreStats>({ orgs: 0, tenants: 0, users: 0, billingLogs: 0, supportTickets: 0 });
  const [visitSummary, setVisitSummary] = useState<VisitSummary>(EMPTY_SUMMARY);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(true);

  useEffect(() => {
    const fetchCoreStats = async () => {
      const [
        { count: orgsCount },
        { count: tenantsCount },
        { count: usersCount },
        { count: billingLogsCount },
        { count: supportTicketsCount },
      ] = await Promise.all([
        supabase.from("organizations").select("*", { count: "exact", head: true }),
        supabase.from("tenants").select("*", { count: "exact", head: true }),
        supabase.from("app_users").select("*", { count: "exact", head: true }),
        supabase.from("saas_payment_logs").select("*", { count: "exact", head: true }),
        supabase.from("support_requests").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        orgs: orgsCount || 0,
        tenants: tenantsCount || 0,
        users: usersCount || 0,
        billingLogs: billingLogsCount || 0,
        supportTickets: supportTicketsCount || 0,
      });
    };

    const fetchVisitStats = async () => {
      setLoadingVisits(true);

      const [{ data: summaryData, error: summaryError }, { data: pagesData, error: pagesError }] = await Promise.all([
        (supabase as any).rpc("get_page_visit_summary", { _days: 30 }),
        (supabase as any).rpc("get_page_visit_pages", { _days: 30, _limit: 8 }),
      ]);

      if (summaryError) {
        console.error("Error loading visit summary:", summaryError);
      }
      if (pagesError) {
        console.error("Error loading top pages:", pagesError);
      }

      setVisitSummary(summaryData?.[0] ?? EMPTY_SUMMARY);
      setTopPages(pagesData ?? []);
      setLoadingVisits(false);
    };

    void fetchCoreStats();
    void fetchVisitStats();
  }, []);

  return (
    <div className="min-h-screen bg-muted/20 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">SuperAdmin Panel</h1>
            <p className="text-muted-foreground">Sistema de control global y métricas públicas de Kurso</p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              window.location.href = "/";
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <MetricCard title="Organizaciones" value={stats.orgs} subtitle="Colegios registrados" icon={<Building2 className="h-4 w-4 text-muted-foreground" />} onClick={() => navigate("/admin/organizations")} />
          <MetricCard title="Tenants (Cursos)" value={stats.tenants} subtitle="Cursos activos" icon={<Database className="h-4 w-4 text-muted-foreground" />} onClick={() => navigate("/admin/tenants")} />
          <MetricCard title="Usuarios Globales" value={stats.users} subtitle="Usuarios en plataforma" icon={<Users className="h-4 w-4 text-muted-foreground" />} onClick={() => navigate("/admin/users")} />
          <MetricCard title="Billing SaaS" value={stats.billingLogs} subtitle="Transacciones auditadas" icon={<CreditCard className="h-4 w-4 text-muted-foreground" />} onClick={() => navigate("/admin/billing")} />
          <MetricCard title="Tickets Soporte" value={stats.supportTickets} subtitle="Solicitudes registradas" icon={<LifeBuoy className="h-4 w-4 text-muted-foreground" />} onClick={() => navigate("/admin/support")} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Visitas públicas últimos 30 días</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <InfoCard title="Visitas totales" value={visitSummary.total_visits} subtitle="Rutas públicas trackeadas" icon={<Eye className="h-4 w-4 text-primary" />} loading={loadingVisits} />
            <InfoCard title="Visitantes únicos" value={visitSummary.unique_visitors} subtitle="Por navegador/dispositivo" icon={<Users className="h-4 w-4 text-primary" />} loading={loadingVisits} />
            <InfoCard title="Home" value={visitSummary.home_visits} subtitle="Visitas a /" icon={<MousePointerClick className="h-4 w-4 text-primary" />} loading={loadingVisits} />
            <InfoCard title="SEO pages" value={visitSummary.seo_visits} subtitle="Landings y guías nuevas" icon={<BarChart3 className="h-4 w-4 text-primary" />} loading={loadingVisits} />
            <InfoCard title="Blog" value={visitSummary.blog_visits} subtitle="Blog y posts" icon={<MousePointerClick className="h-4 w-4 text-primary" />} loading={loadingVisits} />
            <InfoCard title="Últimos 7 días" value={visitSummary.visits_last_7_days} subtitle="Pulso reciente" icon={<Eye className="h-4 w-4 text-primary" />} loading={loadingVisits} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top páginas por visitas</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingVisits ? (
                <p className="text-sm text-muted-foreground">Cargando métricas de visitas...</p>
              ) : topPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay datos. Las visitas empezarán a aparecer después del despliegue y las primeras navegaciones.</p>
              ) : (
                <div className="space-y-3">
                  {topPages.map((page) => (
                    <div key={page.path} className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{page.path}</p>
                        <p className="text-xs text-muted-foreground">
                          Última visita{" "}
                          {page.last_visit
                            ? formatDistanceToNow(new Date(page.last_visit), { addSuffix: true, locale: es })
                            : "sin datos"}
                        </p>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visitas</p>
                          <p className="text-lg font-semibold">{page.visits}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Únicos</p>
                          <p className="text-lg font-semibold">{page.unique_visitors}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <h2 className="text-xl font-semibold">Gestión</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ActionCard title="Organizaciones" description="Crear y gestionar colegios/instituciones. Asignar planes." icon={<Building2 className="h-5 w-5 text-blue-500" />} onClick={() => navigate("/admin/organizations")} />
          <ActionCard title="Usuarios Globales" description="Ver y administrar usuarios de toda la plataforma." icon={<Users className="h-5 w-5 text-green-500" />} onClick={() => navigate("/admin/users")} />
          <ActionCard title="Billing SaaS" description="Revisar transacciones, estados y recaudación de Mercado Pago." icon={<CreditCard className="h-5 w-5 text-amber-500" />} onClick={() => navigate("/admin/billing")} />
          <ActionCard title="Soporte" description="Gestionar tickets internos y solicitudes publicas de soporte." icon={<LifeBuoy className="h-5 w-5 text-cyan-500" />} onClick={() => navigate("/admin/support")} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  onClick,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function InfoCard({
  title,
  value,
  subtitle,
  icon,
  loading,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? "..." : value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={onClick}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
