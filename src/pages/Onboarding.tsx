import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

export default function Onboarding() {
    const navigate = useNavigate();
    const { user, updateProfile } = useAuth(); // Assuming updateProfile is exposed in AuthContext, if not check context.
    const { refreshTenants } = useTenant();

    const [courseName, setCourseName] = useState("");
    const [fullName, setFullName] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!courseName.trim() || !fullName.trim() || !whatsapp.trim()) {
            toast.error("Por favor completa todos los campos para configurar tu cuenta");
            return;
        }

        setLoading(true);
        try {
            // 1. Update User Profile first
            if (user) {
                const { error: updateError } = await supabase
                    .from('app_users')
                    .update({
                        full_name: fullName,
                        whatsapp_number: whatsapp
                    })
                    .eq('id', user.id);

                if (updateError) {
                    console.error("Profile update failed", updateError);

                    // Handle duplicate unique constraint (WhatsApp)
                    if (updateError.code === '23505') {
                        throw new Error("Este número de WhatsApp ya está registrado en otra cuenta.");
                    }

                    throw new Error("Error al guardar tu perfil. Intenta nuevamente.");
                }
            }

            // 2. Call the RPC to create tenant and assign owner role
            const { data, error } = await supabase
                .rpc('create_own_tenant', { new_tenant_name: courseName });

            if (error) throw error;

            toast.success("¡Curso creado exitosamente!");

            // Critical: Refresh tenants context so the new tenant appears and we are switched to it
            await refreshTenants();

            // Navigate to dashboard - The IndexSwitcher/TenantContext will handle the rest
            navigate("/?welcome=true");

        } catch (error: any) {
            console.error("Error creating course:", error);
            toast.error(error.message || "Error al crear el curso. Intenta nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
            <Card className="w-full max-w-md shadow-lg border-primary/10">
                <CardHeader className="flex flex-col items-center gap-4 text-center">
                    <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-2 animate-bounce-slow">
                        <Rocket className="h-10 w-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-bold">¡Bienvenido a Kurso!</CardTitle>
                        <CardDescription>
                            Para comenzar tu prueba gratis de 7 días, <br />
                            necesitamos crear tu primer espacio de trabajo.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateCourse} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Tu Nombre Completo</Label>
                                <Input
                                    id="fullName"
                                    placeholder="Ej. Juan Pérez"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="whatsapp">Tu WhatsApp</Label>
                                <Input
                                    id="whatsapp"
                                    type="tel"
                                    placeholder="+56912345678"
                                    value={whatsapp}
                                    onChange={(e) => setWhatsapp(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="courseName">Nombre de tu Curso o Colegio</Label>
                                <Input
                                    id="courseName"
                                    placeholder="Ej. Pre-Kinder A 2025"
                                    value={courseName}
                                    onChange={(e) => setCourseName(e.target.value)}
                                    disabled={loading}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-11 text-base gap-2" disabled={loading}>
                            {loading ? (
                                <>Configurando... <Loader2 className="h-4 w-4 animate-spin" /></>
                            ) : (
                                "Crear mi Curso Oficial"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
