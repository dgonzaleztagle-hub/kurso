import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Organization } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Building2, Calendar, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Organizations() {
    const navigate = useNavigate();
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchOrgs();
    }, []);

    const fetchOrgs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            toast.error("Error al cargar organizaciones");
            console.error(error);
        } else {
            setOrgs(data as Organization[]);
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newOrgName.trim()) return;

        setCreating(true);
        const { data, error } = await supabase
            .from('organizations')
            .insert([{ name: newOrgName, plan_type: 'institutional' }])
            .select()
            .single();

        if (error) {
            toast.error("Error al crear la organización");
            console.error(error);
        } else {
            toast.success("Organización creada exitosamente");
            setOrgs([data as Organization, ...orgs]);
            setIsCreateOpen(false);
            setNewOrgName("");
        }
        setCreating(false);
    };

    const filteredOrgs = orgs.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Organizaciones</h1>
                    <p className="text-muted-foreground">Gestiona los colegios e instituciones registrados.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Organización
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nueva Organización</DialogTitle>
                            <DialogDescription>
                                Agrega un nuevo colegio o institución a la plataforma.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label htmlFor="name" className="text-sm font-medium">Nombre de la Institución</label>
                                <Input
                                    id="name"
                                    placeholder="Ej: Colegio San Agustín"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreate} disabled={creating}>
                                {creating ? "Creando..." : "Crear"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardHeader className="p-0">
                    {/* Table styling wrapper */}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Válido Hasta</TableHead>
                                <TableHead className="text-right">Fecha Registro</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Cargando...
                                    </TableCell>
                                </TableRow>
                            ) : filteredOrgs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No se encontraron organizaciones.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOrgs.map((org) => (
                                    <TableRow
                                        key={org.id}
                                        className="hover:bg-muted/50 cursor-pointer"
                                        onClick={() => navigate(`/admin/organizations/${org.id}`)}
                                    >
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                                                <Building2 className="h-4 w-4" />
                                            </div>
                                            {org.name}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                {org.plan_type}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {org.valid_until ? (
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {format(new Date(org.valid_until), 'dd/MM/yyyy')}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {format(new Date(org.created_at), 'dd MMM yyyy')}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
