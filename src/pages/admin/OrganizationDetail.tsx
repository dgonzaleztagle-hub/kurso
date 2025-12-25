import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Organization, Tenant } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Plus, School, Calendar, GraduationCap, UserCog, CheckCircle2, Clock } from "lucide-react";
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

export default function OrganizationDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [org, setOrg] = useState<Organization | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTenantName, setNewTenantName] = useState("");
    const [creating, setCreating] = useState(false);
    const [initialPlanMonths, setInitialPlanMonths] = useState(12);

    // Create Owner States
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserName, setNewUserName] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [assigning, setAssigning] = useState(false);

    // View Credentials States
    const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
    const [ownerDetails, setOwnerDetails] = useState<{ full_name: string, email: string } | null>(null);

    // Org Edit State
    const [isEditingOrg, setIsEditingOrg] = useState(false);
    const [orgName, setOrgName] = useState("");
    const [updatingOrg, setUpdatingOrg] = useState(false);

    // Subscription Management States
    const [isExtendTrialOpen, setIsExtendTrialOpen] = useState(false);
    const [extendDays, setExtendDays] = useState(5);
    const [processingSub, setProcessingSub] = useState(false);

    const [isActivatePlanOpen, setIsActivatePlanOpen] = useState(false);
    const [planMonths, setPlanMonths] = useState(12);

    // Course Detail Modal State
    const [isDetailOpen, setIsDetailOpen] = useState(false);

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



    // Archive / Close Year State
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [archiving, setArchiving] = useState(false);

    // ... existing handles ...

    const handleArchiveTenant = async () => {
        if (!selectedTenant) return;
        setArchiving(true);
        try {
            const { error } = await supabase
                .from('tenants')
                .update({ status: 'archived' })
                .eq('id', selectedTenant.id);

            if (error) throw error;
            toast.success("Curso finalizado y archivado correctamente");
            setIsArchiveOpen(false);
            fetchDetails();
        } catch (error: any) {
            console.error("Error archiving:", error);
            toast.error("Error al archivar curso");
        } finally {
            setArchiving(false);
        }
    };

    // Helper calculate valid_until
    const calculateValidUntil = (months: number) => {
        const date = new Date();
        date.setMonth(date.getMonth() + months);
        return date.toISOString();
    };

    const handleCreateTenant = async () => {
        if (!newTenantName.trim() || !org) return;

        setCreating(true);
        // Create Tenant linked to this Org
        // Slug generation logic: name-orgname + timestamp
        const slug = `${newTenantName.toLowerCase().replace(/\s+/g, '-')}-${org.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`.replace(/[^a-z0-9-]/g, '');

        // We need auth user id as initial technical owner_id
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
                owner_id: user.id, // SuperAdmin technically owns it until assigned
                subscription_status: 'active',
                valid_until: calculateValidUntil(initialPlanMonths),
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

    const handleAssignOwner = async () => {
        if (!selectedTenant || !newUserEmail.trim() || !newUserName.trim() || !newUserPassword.trim()) {
            toast.error("Complete todos los campos");
            return;
        }
        setAssigning(true);

        try {
            const { data, error } = await supabase.functions.invoke('create-admin-user', {
                body: {
                    name: newUserName,
                    userName: newUserEmail.split('@')[0], // Fallback username
                    email: newUserEmail,
                    password: newUserPassword,
                    tenantId: selectedTenant.id
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success(`Dueño creado y asignado con éxito: ${newUserName}`);
            setIsAssignOpen(false);
            setNewUserEmail("");
            setNewUserName("");
            setNewUserPassword("");
            fetchDetails();
        } catch (error: any) {
            console.error("Error creating owner:", error);
            toast.error(error.message || "Error al crear encargado");
        } finally {
            setAssigning(false);
        }
    };

    const handleUpdateOrg = async () => {
        if (!org || !orgName.trim()) return;
        setUpdatingOrg(true);
        const { error } = await supabase
            .from('organizations')
            .update({ name: orgName })
            .eq('id', org.id);

        if (error) {
            toast.error("Error al actualizar organización");
        } else {
            toast.success("Organización actualizada");
            setOrg({ ...org, name: orgName });
        }
        setUpdatingOrg(false);
        setIsEditingOrg(false);
    };

    const handleViewCredentials = async (tenant: Tenant) => {
        setSelectedTenant(tenant);
        setOwnerDetails(null);
        setIsCredentialsOpen(true);

        if (!tenant.owner_id) return;

        const { data, error } = await supabase
            .from('app_users')
            .select('full_name, email')
            .eq('id', tenant.owner_id)
            .single();

        if (!error && data) {
            setOwnerDetails(data);
        }
    };

    const handleExtendTrial = async () => {
        if (!selectedTenant) return;
        setProcessingSub(true);
        try {
            const newDate = new Date();
            newDate.setDate(newDate.getDate() + parseInt(extendDays.toString()));

            const { error } = await supabase
                .from('tenants')
                .update({
                    trial_ends_at: newDate.toISOString(),
                    subscription_status: 'trial'
                })
                .eq('id', selectedTenant.id);

            if (error) throw error;
            toast.success(`Trial extendido por ${extendDays} días`);
            setIsExtendTrialOpen(false);
            fetchDetails();
        } catch (error: any) {
            console.error("Error extending trial:", error);
            toast.error("Error al extender trial");
        } finally {
            setProcessingSub(false);
        }
    };

    const handleActivatePlan = async () => {
        if (!selectedTenant) return;
        setProcessingSub(true);
        try {
            const newDate = new Date();
            newDate.setMonth(newDate.getMonth() + parseInt(planMonths.toString()));

            const { error } = await supabase
                .from('tenants')
                .update({
                    valid_until: newDate.toISOString(),
                    subscription_status: 'active'
                })
                .eq('id', selectedTenant.id);

            if (error) throw error;
            toast.success(`Plan activado por ${planMonths} meses`);
            setIsActivatePlanOpen(false);
            fetchDetails();
        } catch (error: any) {
            console.error("Error activating plan:", error);
            toast.error("Error al activar plan");
        } finally {
            setProcessingSub(false);
        }
    };

    // Helper to format date safely
    const formatDate = (dateString: string | null) => {
        if (!dateString) return "N/A";
        try {
            return format(new Date(dateString), "dd MMM yyyy");
        } catch (e) {
            return "Indefinido";
        }
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
                        <span>Registrado el {formatDate(org.created_at)}</span>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Cursos (Tenants)</CardTitle>
                        <CardDescription>
                            Estos son los espacios de trabajo individuales. Click en la fila para ver detalles.
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
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Duración del Plan (Meses)</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                placeholder="12"
                                                value={initialPlanMonths}
                                                onChange={(e) => setInitialPlanMonths(parseInt(e.target.value) || 1)}
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
                                        <TableRow
                                            key={tenant.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => {
                                                setSelectedTenant(tenant);
                                                if (tenant.owner_id) {
                                                    // Optional: pre-fetch handled by specific view action
                                                }
                                                setIsDetailOpen(true);
                                            }}
                                        >
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <GraduationCap className="h-4 w-4 text-primary" />
                                                    {tenant.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                                    ${tenant.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                                                        tenant.subscription_status === 'trial' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'}`}>
                                                    {tenant.subscription_status || 'Sin estado'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Extender Trial"
                                                        onClick={() => {
                                                            setSelectedTenant(tenant);
                                                            setIsExtendTrialOpen(true);
                                                        }}
                                                    >
                                                        <Calendar className="h-4 w-4 text-blue-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Activar Plan"
                                                        onClick={() => {
                                                            setSelectedTenant(tenant);
                                                            setIsActivatePlanOpen(true);
                                                        }}
                                                    >
                                                        <School className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Gestionar Encargado"
                                                        onClick={() => {
                                                            if (tenant.owner_id) {
                                                                handleViewCredentials(tenant);
                                                            } else {
                                                                setSelectedTenant(tenant);
                                                                setIsAssignOpen(true);
                                                            }
                                                        }}
                                                    >
                                                        <UserCog className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Dialog: Archive Confirmation */}
                <Dialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Finalizar Año Escolar</DialogTitle>
                            <DialogDescription>
                                ¿Estás seguro que deseas cerrar el año para <b>{selectedTenant?.name}</b>?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-3 text-sm text-muted-foreground">
                            <p className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold">⚠</span>
                                El curso pasará a estado <b>ARCHIVADO</b> (Solo Lectura).
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-primary font-bold">ℹ</span>
                                Podrás iniciar el proceso de <b>Nuevo Año</b> desde el Dashboard principal.
                            </p>
                            <p>
                                Esta acción no se puede deshacer fácilmente. Asegúrate de que todas las operaciones del año estén concluidas.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsArchiveOpen(false)}>Cancelar</Button>
                            <Button variant="destructive" onClick={handleArchiveTenant} disabled={archiving}>
                                {archiving ? "Archivando..." : "Sí, Finalizar Año"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Card>
                    <CardHeader>
                        <CardTitle>Configuración</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Nombre de la Organización</label>
                            <div className="flex gap-2">
                                <Input
                                    value={isEditingOrg ? orgName : org.name}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    disabled={!isEditingOrg}
                                />
                                {isEditingOrg ? (
                                    <>
                                        <Button onClick={handleUpdateOrg} disabled={updatingOrg}>Guardar</Button>
                                        <Button variant="ghost" onClick={() => setIsEditingOrg(false)}>Cancelar</Button>
                                    </>
                                ) : (
                                    <Button variant="outline" onClick={() => {
                                        setOrgName(org.name);
                                        setIsEditingOrg(true);
                                    }}>Editar</Button>
                                )}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Plan Actual</label>
                            <Input value={org.plan_type} disabled />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalle del Curso</DialogTitle>
                        <DialogDescription>
                            Información completa de suscripción y estado.
                        </DialogDescription>
                    </DialogHeader>
                    {
                        selectedTenant && (
                            <div className="grid gap-6 py-4">
                                {/* Basic Info */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4" />
                                        Información General
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Nombre</p>
                                            <p className="font-medium">{selectedTenant.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Creado el</p>
                                            <p className="font-medium">{formatDate(selectedTenant.created_at)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-border" />

                                {/* Subscription Info */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Estado de Suscripción
                                    </h4>
                                    <div className="space-y-3 bg-muted/40 p-3 rounded-md border">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Estado Actual</span>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase
                                             ${selectedTenant.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                                                    selectedTenant.subscription_status === 'trial' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-700'}`}>
                                                {selectedTenant.subscription_status || 'SIN ESTADO'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Trial Vence</span>
                                            <span className="text-sm font-mono font-medium">
                                                {selectedTenant.trial_ends_at ? formatDate(selectedTenant.trial_ends_at) : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Plan Válido Hasta</span>
                                            <span className="text-sm font-mono font-medium">
                                                {selectedTenant.valid_until ? formatDate(selectedTenant.valid_until) : 'Indefinido'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => {
                                            if (selectedTenant.owner_id) {
                                                handleViewCredentials(selectedTenant);
                                            } else {
                                                setIsAssignOpen(true);
                                            }
                                        }}
                                    >
                                        <UserCog className="mr-2 h-4 w-4" />
                                        {selectedTenant.owner_id ? 'Ver Credenciales Encargado' : 'Asignar Encargado'}
                                    </Button>
                                </div>
                            </div>
                        )
                    }
                    <DialogFooter>
                        <Button onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent >
            </Dialog >

            {/* Dialog for Creating Owner */}
            < Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Encargado del Curso</DialogTitle>
                        <DialogDescription>
                            Crea una cuenta nueva para el <b>Director/Profesor</b> de <b>{selectedTenant?.name}</b>.
                            Se asignará automáticamente como Owner.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre Completo</label>
                            <Input
                                placeholder="Ej: Juan Pérez"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email Institucional</label>
                            <Input
                                placeholder="profesor@colegio.com"
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Contraseña Inicial</label>
                            <Input
                                type="text"
                                placeholder="Mínimo 6 caracteres"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Comparte esta contraseña con el usuario.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAssignOwner} disabled={assigning}>
                            {assigning ? "Creando..." : "Crear y Asignar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Dialog for Viewing Credentials */}
            < Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Credenciales del Curso</DialogTitle>
                        <DialogDescription>
                            Información del encargado y acceso al curso <b>{selectedTenant?.name}</b>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {!selectedTenant?.owner_id ? (
                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm border border-yellow-200">
                                Este curso aún no tiene un encargado asignado.
                            </div>
                        ) : ownerDetails ? (
                            <>
                                <div className="grid gap-1">
                                    <label className="text-sm font-medium text-muted-foreground">Encargado (Owner)</label>
                                    <div className="text-lg font-medium select-all">{ownerDetails.full_name || "Sin Nombre"}</div>
                                </div>
                                <div className="grid gap-1">
                                    <label className="text-sm font-medium text-muted-foreground">Email de Acceso</label>
                                    <div className="text-lg font-medium select-all">{ownerDetails.email}</div>
                                </div>
                                <div className="grid gap-1">
                                    <label className="text-sm font-medium text-muted-foreground">Contraseña</label>
                                    <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                        •••••••• (Oculta por seguridad)
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Si el usuario olvidó su contraseña, deberá usar la opción "Recuperar Contraseña" en el login.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setIsCredentialsOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Dialog: Extend Trial */}
            < Dialog open={isExtendTrialOpen} onOpenChange={setIsExtendTrialOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Extender Periodo de Prueba</DialogTitle>
                        <DialogDescription>
                            Añade días extra al periodo de prueba de <b>{selectedTenant?.name}</b>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Días a añadir (desde HOY)</label>
                            <Input
                                type="number"
                                min="1"
                                value={extendDays}
                                onChange={(e) => setExtendDays(parseInt(e.target.value))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsExtendTrialOpen(false)}>Cancelar</Button>
                        <Button onClick={handleExtendTrial} disabled={processingSub}>
                            {processingSub ? "Procesando..." : "Extender Trial"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Dialog: Activate Plan */}
            < Dialog open={isActivatePlanOpen} onOpenChange={setIsActivatePlanOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Activar Plan Institucional</DialogTitle>
                        <DialogDescription>
                            Activa el plan completo para <b>{selectedTenant?.name}</b>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Duración (Meses)</label>
                            <Input
                                type="number"
                                min="1"
                                value={planMonths}
                                onChange={(e) => setPlanMonths(parseInt(e.target.value))}
                            />
                            <p className="text-xs text-muted-foreground">La fecha de expiración se calculará desde HOY.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsActivatePlanOpen(false)}>Cancelar</Button>
                        <Button onClick={handleActivatePlan} disabled={processingSub} className="bg-green-600 hover:bg-green-700">
                            {processingSub ? "Procesando..." : "Activar Plan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    );
}
