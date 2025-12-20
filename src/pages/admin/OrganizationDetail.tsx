import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Organization, Tenant } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Plus, School, Calendar, MoreVertical, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function OrganizationDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [org, setOrg] = useState<Organization | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTenantName, setNewTenantName] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (id) {
            fetchDetails();
        } else {
            setLoading(false);
            navigate("/admin/organizations");
        }
    }, [id]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            // Fetch Org
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', id)
                .single();

            if (orgError) {
                console.error("Error fetching org:", orgError);
                toast.error("Error al cargar la organización");
                navigate("/admin/organizations");
                return;
            }
            setOrg(orgData as Organization);

            // Fetch Tenants
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .select('*')
                .eq('organization_id', id)
                .order('created_at', { ascending: false });

            if (tenantError) {
                console.error("Error fetching tenants:", tenantError);
                toast.error("Error al cargar los cursos");
            } else {
                setTenants(tenantData as Tenant[]);
            }
        } catch (error) {
            console.error("Unexpected error:", error);
            toast.error("Error inesperado al cargar detalles");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTenant = async () => {
        if (!newTenantName.trim() || !org) return;

        setCreating(true);
        // Create Tenant linked to this Org
        // Slug generation logic: name-orgname + timestamp
        const slug = `${newTenantName.toLowerCase().replace(/\s+/g, '-')}-${org.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`.replace(/[^a-z0-9-]/g, '');

        // We need auth user id as owner_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("Sesión inválida");
            setCreating(false);
            return;
        }

        const { data, error } = await supabase
            .from('tenants')
            .insert([{
                name: newTenantName,
                organization_id: org.id,
                owner_id: user.id, // SuperAdmin es el owner técnico por ahora
                subscription_status: 'active',
                slug: slug,
                settings: {}
            }])
            .select()
            .single();

        if (error) {
            toast.error("Error al crear el curso");
            console.error(error);
        } else {
            toast.success("Curso creado exitosamente");
            setTenants([data as Tenant, ...tenants]);
            setIsCreateOpen(false);
            setNewTenantName("");
        }
        setCreating(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Cargando detalles...</p>
                </div>
            </div>
        );
    }

    if (!org) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="bg-destructive/10 p-4 rounded-full">
                    <School className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold">No se pudo cargar la organización</h2>
                <p className="text-muted-foreground text-center max-w-sm">
                    Puede que no tengas permisos para ver esto o que el registro no exista.
                </p>
                <Button onClick={() => navigate("/admin/organizations")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a la lista
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/admin/organizations")}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="capitalize badge bg-secondary px-2 rounded-full text-secondary-foreground">{org.plan_type}</span>
                        <span>•</span>
                        <span>Registrado el {format(new Date(org.created_at), 'dd MMM yyyy')}</span>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Cursos (Tenants)</CardTitle>
                        <CardDescription>
                            Estos son los espacios de trabajo individuales.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-end mb-4">
                            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Nuevo Curso
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Crear Nuevo Curso</DialogTitle>
                                        <DialogDescription>
                                            Un Tenant independiente para "{org.name}".
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Nombre del Curso</label>
                                            <Input
                                                placeholder="Ej: Pre-Kinder A 2025"
                                                value={newTenantName}
                                                onChange={(e) => setNewTenantName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                                        <Button onClick={handleCreateTenant} disabled={creating}>
                                            {creating ? "Creando..." : "Crear Tenant"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                            No hay cursos creados aún.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tenants.map((tenant) => (
                                        <TableRow key={tenant.id}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <GraduationCap className="h-4 w-4 text-primary" />
                                                {tenant.name}
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                    {tenant.subscription_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Configuración</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">Próximamente: Editar datos de facturación, contactos y límites del plan.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
