import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppUser } from "@/types/db";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, MessageCircle, MoreHorizontal, Calendar, School, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function UsersList() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    // Subscription Management States
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any | null>(null);

    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [selectedTenantName, setSelectedTenantName] = useState<string>("");

    const [isExtendTrialOpen, setIsExtendTrialOpen] = useState(false);
    const [extendDays, setExtendDays] = useState(5);
    const [processingSub, setProcessingSub] = useState(false);

    const [isActivatePlanOpen, setIsActivatePlanOpen] = useState(false);
    const [planMonths, setPlanMonths] = useState(12);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        // Usar RPC para traer solo Clients (Dueños de Cursos Independientes)
        const { data, error } = await supabase.rpc('get_platform_clients' as any);

        if (!error && data) {
            setUsers(data as any[]);
        } else if (error) {
            console.error("Error fetching users:", error);
            toast.error("Error al cargar clientes");
        }
        setLoading(false);
    };

    const handleWhatsApp = (phone: string | null) => {
        if (!phone) {
            toast.error("Este usuario no tiene WhatsApp registrado");
            return;
        }
        // Clean phone number (remove +, spaces, dashes) for the URL
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const filteredUsers = users.filter(u =>
        (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleExtendTrial = async () => {
        if (!selectedTenantId) return;
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
                .eq('id', selectedTenantId);

            if (error) throw error;
            toast.success(`Trial extendido por ${extendDays} días`);
            setIsExtendTrialOpen(false);
            fetchUsers(); // Refresh list to see implicit changes if any
        } catch (error: any) {
            console.error("Error extending trial:", error);
            toast.error("Error al extender trial");
        } finally {
            setProcessingSub(false);
        }
    };

    const handleActivatePlan = async () => {
        if (!selectedTenantId) return;
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
                .eq('id', selectedTenantId);

            if (error) throw error;
            toast.success(`Plan activado por ${planMonths} meses`);
            setIsActivatePlanOpen(false);
            fetchUsers();
        } catch (error: any) {
            console.error("Error activating plan:", error);
            toast.error("Error al activar plan");
        } finally {
            setProcessingSub(false);
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate("/admin")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Clientes (Dueños Independientes)</h1>
                    <p className="text-muted-foreground">Gestión de creadores de cursos sin organización</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre del Cliente</TableHead>
                            <TableHead>Curso (Propio)</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Fecha Registro</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">Cargando clientes...</TableCell>
                            </TableRow>
                        ) : filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                    No se encontraron clientes independientes.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((user: any) => (
                                <TableRow
                                    key={user.user_id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => {
                                        setSelectedUser(user);
                                        setIsDetailOpen(true);
                                    }}
                                >
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.full_name || 'Sin Nombre'}</span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-primary">{user.tenant_name}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {user.whatsapp_number ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 rounded-full bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                                                    onClick={() => handleWhatsApp(user.whatsapp_number)}
                                                    title={`Enviar WhatsApp a ${user.whatsapp_number}`}
                                                >
                                                    <MessageCircle className="h-4 w-4" />
                                                    <span className="sr-only">WhatsApp</span>
                                                </Button>
                                            ) : (
                                                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
                                                    <MessageCircle className="h-4 w-4 opacity-50" />
                                                </div>
                                            )}
                                            <div className="flex flex-col text-sm">
                                                <span className="font-medium">{user.whatsapp_number || "Sin contacto"}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Action: Extend Trial */}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50"
                                                onClick={() => {
                                                    if (user.tenant_id) {
                                                        setSelectedTenantId(user.tenant_id);
                                                        setSelectedTenantName(user.tenant_name || "Curso");
                                                        setIsExtendTrialOpen(true);
                                                    } else {
                                                        toast.error("Sin Tenant ID");
                                                    }
                                                }}
                                                title="Extender Trial"
                                            >
                                                <Calendar className="h-4 w-4" />
                                            </Button>

                                            {/* Action: Activate Plan */}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                                                onClick={() => {
                                                    if (user.tenant_id) {
                                                        setSelectedTenantId(user.tenant_id);
                                                        setSelectedTenantName(user.tenant_name || "Curso");
                                                        setIsActivatePlanOpen(true);
                                                    } else {
                                                        toast.error("Sin Tenant ID");
                                                    }
                                                }}
                                                title="Activar Plan"
                                            >
                                                <School className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Dialog: Extend Trial */}
            <Dialog open={isExtendTrialOpen} onOpenChange={setIsExtendTrialOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Extender Periodo de Prueba</DialogTitle>
                        <DialogDescription>
                            Añade días extra al periodo de prueba de <b>{selectedTenantName}</b>.
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
            </Dialog>

            {/* Dialog: Activate Plan */}
            <Dialog open={isActivatePlanOpen} onOpenChange={setIsActivatePlanOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Activar Plan</DialogTitle>
                        <DialogDescription>
                            Activa el plan para <b>{selectedTenantName}</b>.
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
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsActivatePlanOpen(false)}>Cancelar</Button>
                        <Button onClick={handleActivatePlan} disabled={processingSub} className="bg-green-600 hover:bg-green-700">
                            {processingSub ? "Procesando..." : "Activar Plan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Client Details */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Detalle del Cliente</DialogTitle>
                        <DialogDescription>
                            Información completa y estado de suscripción.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedUser && (
                        <div className="grid gap-6 py-4">
                            {/* Personal Info */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <div className="p-1 bg-primary/10 rounded">User</div>
                                    Información Personal
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-muted-foreground">Nombre Completo</div>
                                        <div className="font-medium">{selectedUser.full_name || "Sin nombre"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Email</div>
                                        <div className="font-medium">{selectedUser.email}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">WhatsApp</div>
                                        <div className="font-medium">{selectedUser.whatsapp_number || "No registrado"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Fecha Registro</div>
                                        <div className="font-medium">{new Date(selectedUser.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Subscription Info */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <div className="p-1 bg-green-100 text-green-700 rounded"><School className="h-4 w-4" /></div>
                                    Estado de Suscripción (Curso)
                                </h3>
                                <div className="grid gap-3 text-sm p-4 bg-muted/30 rounded-lg border">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Nombre del Curso:</span>
                                        <span className="font-bold text-base">{selectedUser.tenant_name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Estado Actual:</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedUser.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                                                selectedUser.subscription_status === 'trial' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {selectedUser.subscription_status || 'Sin estado'}
                                        </span>
                                    </div>

                                    {selectedUser.subscription_status === 'trial' && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Trial Vence el:</span>
                                            <span className="font-medium text-orange-600">
                                                {selectedUser.trial_ends_at ? new Date(selectedUser.trial_ends_at).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                    )}

                                    {selectedUser.subscription_status === 'active' && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Plan Válido hasta:</span>
                                            <span className="font-medium text-green-600">
                                                {selectedUser.valid_until ? new Date(selectedUser.valid_until).toLocaleDateString() : 'Indefinido'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
