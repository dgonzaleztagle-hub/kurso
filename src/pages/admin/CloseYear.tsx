import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AlertTriangle, Archive, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CloseYear() {
    const { currentTenant, refreshTenants, roleInCurrentTenant } = useTenant();
    const { userRole } = useAuth();
    const navigate = useNavigate();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [confirmName, setConfirmName] = useState("");
    const [loading, setLoading] = useState(false);

    if (!currentTenant) return <div className="p-8">Cargando curso...</div>;

    const handleArchive = async () => {
        if (confirmName !== currentTenant.name) {
            toast.error("El nombre ingresado no coincide.");
            return;
        }

        console.log("DEBUG: Attempting archive for:", currentTenant.id);

        setLoading(true);
        try {
            // Updated to use RPC call for robust permissions
            const { error } = await supabase.rpc('archive_tenant', {
                target_tenant_id: currentTenant.id
            });

            if (error) throw error;

            console.log("DEBUG: Archived successfully via RPC.");
            toast.success("Año Escolar finalizado correctamente.");

            // Force refresh to update context
            await refreshTenants();

            // Short delay to allow context to propagate
            setTimeout(() => {
                navigate("/");
            }, 500);

        } catch (error: any) {
            console.error("Error archiving:", error);
            toast.error("Error al finalizar el año: " + error.message);
            setLoading(false);
        }
    };

    return (
        <div className="container max-w-2xl py-8 space-y-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Configuración de Cierre</h1>
                <p className="text-muted-foreground">Gestión del ciclo de vida del curso académico.</p>
            </div>

            <Card className="border-orange-200 bg-orange-50/50">
                <CardHeader>
                    <div className="flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="h-5 w-5" />
                        <CardTitle>Finalizar Año Escolar</CardTitle>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Esta acción marcará el curso actual <b>{currentTenant.name}</b> como <b>ARCHIVADO</b>.
                        <br /><br />
                        <ul className="list-disc list-inside space-y-1">
                            <li>El curso pasará a modo "Solo Lectura".</li>
                            <li>No se podrán registrar nuevos pagos ni modificar datos.</li>
                            <li>Se activará el asistente para crear el curso del próximo año.</li>
                        </ul>
                    </div>
                </CardHeader>
                <CardFooter>
                    <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        <Archive className="mr-2 h-4 w-4" />
                        Finalizar Año y Archivar
                    </Button>
                </CardFooter>
            </Card>

            {/* Confirmation Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Estás absolutamente seguro?</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer fácilmente. Para confirmar, escribe el nombre del curso:
                            <br />
                            <span className="font-bold select-all block mt-1">{currentTenant.name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Input
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder="Escribe el nombre del curso aquí"
                            className="font-mono"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={handleArchive}
                            disabled={loading || confirmName !== currentTenant.name}
                        >
                            {loading ? "Procesando..." : "Sí, Finalizar Año"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
