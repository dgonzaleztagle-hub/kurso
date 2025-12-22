import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tenant } from "@/types/db";
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
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TenantsList() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('tenants')
            .select(`
                *,
                organization:organizations(name),
                owner:app_users(full_name)
            `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setTenants(data);
        }
        setLoading(false);
    };

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.organization?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container mx-auto py-10 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate("/admin")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
                <h1 className="text-3xl font-bold">Listado Global de Cursos (Tenants)</h1>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar curso o colegio..."
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
                            <TableHead>Nombre del Curso</TableHead>
                            <TableHead>Colegio (Organización)</TableHead>
                            <TableHead>Responsable (Dueño)</TableHead>
                            <TableHead>Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8">Cargando...</TableCell>
                            </TableRow>
                        ) : filteredTenants.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8">No se encontraron cursos.</TableCell>
                            </TableRow>
                        ) : (
                            filteredTenants.map((tenant) => (
                                <TableRow key={tenant.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                                    if (tenant.organization_id) navigate(`/admin/organizations/${tenant.organization_id}`);
                                }}>
                                    <TableCell className="font-medium">{tenant.name}</TableCell>
                                    <TableCell>
                                        {tenant.organization?.name ? (
                                            <span className="flex items-center gap-2">
                                                <span className="font-semibold text-primary">{tenant.organization.name}</span>
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground italic">Sin Organización (Independiente)</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-medium text-purple-700 dark:text-purple-300">
                                            {tenant.owner?.full_name || 'Sin Asignar'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tenant.subscription_status === 'active'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {tenant.subscription_status}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
