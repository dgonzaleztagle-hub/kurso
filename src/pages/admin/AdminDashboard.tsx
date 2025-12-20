import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, LayoutDashboard, Database, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [stats, setStats] = useState({ orgs: 0, tenants: 0, users: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            const { count: orgsCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
            const { count: tenantsCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
            const { count: usersCount } = await supabase.from('app_users').select('*', { count: 'exact', head: true });

            setStats({
                orgs: orgsCount || 0,
                tenants: tenantsCount || 0,
                users: usersCount || 0
            });
        };
        fetchStats();
    }, []);

    return (
        <div className="min-h-screen bg-muted/20 p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary">SuperAdmin Panel</h1>
                        <p className="text-muted-foreground">Sistema de Control Global Kurso SaaS</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={async () => {
                            await signOut();
                            window.location.href = '/';
                        }}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate("/admin/organizations")}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Organizaciones</CardTitle>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.orgs}</div>
                            <p className="text-xs text-muted-foreground">Colegios registrados</p>
                        </CardContent>
                    </Card>
                    <Card
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate("/admin/tenants")}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tenants (Cursos)</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.tenants}</div>
                            <p className="text-xs text-muted-foreground">Cursos activos</p>
                        </CardContent>
                    </Card>
                    <Card
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate("/admin/users")}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Usuarios Globales</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.users}</div>
                            <p className="text-xs text-muted-foreground">Usuarios en plataforma</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Actions Grid */}
                <h2 className="text-xl font-semibold">Gestión</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/organizations")}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-blue-500" />
                                Organizaciones
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Crear y gestionar colegios/instituciones. Asignar planes.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/users")}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-green-500" />
                                Usuarios Globales
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Ver y administrar usuarios de toda la plataforma.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
