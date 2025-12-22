import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AuditLog {
    id: string;
    created_at: string;
    user_id: string;
    action: string;
    entity_name: string;
    entity_id: string;
    details: any;
    user_email?: string; // Loaded via join or secondary query if needed, or stored in log
}

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [userMap, setUserMap] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("audit_logs" as any)
                .select("*")
                .order("created_at", { ascending: false })
                .limit(100);

            if (error) throw error;
            const logsData = data as unknown as AuditLog[] || [];
            setLogs(logsData);

            // Fetch User Names
            const userIds = Array.from(new Set(logsData.map(l => l.user_id).filter(Boolean)));
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('app_users')
                    .select('id, full_name, email')
                    .in('id', userIds);

                if (usersData) {
                    const newMap: Record<string, string> = {};
                    usersData.forEach((u: any) => {
                        newMap[u.id] = u.full_name || u.email || "Usuario sin Nombre";
                    });
                    setUserMap(newMap);
                }
            }
        } catch (error) {
            console.error("Error fetching audit logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case "INSERT": return "bg-green-500 hover:bg-green-600";
            case "UPDATE": return "bg-blue-500 hover:bg-blue-600";
            case "DELETE": return "bg-red-500 hover:bg-red-600";
            default: return "bg-gray-500";
        }
    };

    const friendlyActions: Record<string, string> = {
        INSERT: "Creación",
        UPDATE: "Edición",
        DELETE: "Eliminación"
    };

    const friendlyEntities: Record<string, string> = {
        'public.tenants': 'Curso',
        'tenants': 'Curso',
        'public.app_users': 'Usuario',
        'app_users': 'Usuario',
        'public.tenant_members': 'Miembro',
        'tenant_members': 'Miembro',
        'public.payments': 'Pago',
        'payments': 'Pago',
        'public.students': 'Estudiante',
        'students': 'Estudiante',
        'public.user_roles': 'Permisos de Acceso',
        'user_roles': 'Permisos de Acceso',
        'public.profiles': 'Perfil de Usuario',
        'profiles': 'Perfil de Usuario',
        'public.organizations': 'Institución',
        'organizations': 'Institución'
    };

    const formatEntity = (entity: string) => friendlyEntities[entity] || entity.replace('public.', '');

    const toggleExpand = (id: string) => {
        setExpandedLog(expandedLog === id ? null : id);
    };

    const filteredLogs = logs.filter(log =>
        log.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.user_id && log.user_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="container mx-auto py-8 space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Historial de Cambios</h1>
                    <p className="text-muted-foreground">Registro inmutable de acciones críticas (Guardia de Seguridad)</p>
                </div>
                <Button onClick={fetchLogs} variant="outline" size="icon">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Card className="bg-card border-border/50">
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por entidad, acción o ID de usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 bg-background/50 border-white/10"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-white/10 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Acción</TableHead>
                                    <TableHead>Elemento</TableHead>
                                    <TableHead>Responsable</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            Cargando registros...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No se encontraron registros de auditoría
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <React.Fragment key={log.id}>
                                            <TableRow
                                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => toggleExpand(log.id)}
                                            >
                                                <TableCell>
                                                    {expandedLog === log.id ? (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={getActionColor(log.action)}>
                                                        {friendlyActions[log.action] || log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {formatEntity(log.entity_name)}
                                                </TableCell>
                                                <TableCell className="text-sm" title={log.user_id}>
                                                    {userMap[log.user_id] || (log.user_id ? "Usuario Sistema" : "Anónimo")}
                                                </TableCell>
                                            </TableRow>

                                            {expandedLog === log.id && (
                                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                                    <TableCell colSpan={5} className="p-0">
                                                        <div className="p-4 space-y-2">
                                                            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Detalles del Cambio</h4>
                                                            <pre className="bg-black/50 p-4 rounded-md overflow-x-auto text-xs font-mono text-green-400 border border-green-900/30">
                                                                {JSON.stringify(log.details, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
