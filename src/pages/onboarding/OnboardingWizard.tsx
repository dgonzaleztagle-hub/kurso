import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Rocket, CheckCircle2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function OnboardingWizard() {
    const { user, appUser } = useAuth();
    const { refreshTenants, availableTenants } = useTenant(); // Usar refresh del contexto
    const navigate = useNavigate();
    const { toast } = useToast();
    const [courseName, setCourseName] = useState("");
    const [institutionName, setInstitutionName] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleCreateCourse = async () => {
        if (!courseName.trim() || !institutionName.trim()) {
            toast({
                title: "Campos requeridos",
                description: "Por favor ingresa el nombre de tu colegio y de tu curso.",
                variant: "destructive"
            });
            return;
        }

        try {
            setLoading(true);

            // 1. Llamada a la RPC segura (ahora con Institución)
            const { data, error } = await supabase.rpc('create_own_tenant' as any, {
                new_tenant_name: courseName.trim(),
                new_institution_name: institutionName.trim()
            });

            if (error) throw error;

            setSuccess(true);

            // 2. Feedback visual premium
            toast({
                title: "¡Espacio Configurado!",
                description: `El curso "${courseName}" de "${institutionName}" ha sido creado.`,
                className: "bg-green-50 dark:bg-green-900 border-green-200"
            });

            // 3. Recargar contexto de tenants SIN recargar página completa
            await refreshTenants();

            // 4. Pequeña pausa para que el usuario veja el éxito
            setTimeout(() => {
                navigate("/?welcome=true"); // Redirigir al Dashboard con flag de bienvenida
            }, 1500);

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Error de configuración",
                description: error.message || "No pudimos crear el espacio. Intenta nuevamente.",
                variant: "destructive"
            });
            setLoading(false);
        }
    };

    // AUTO-REDIRECT: If you are already established, get out of here.
    useEffect(() => {
        if (!loading && (appUser?.is_superadmin || availableTenants.length > 0)) {
            if (appUser?.is_superadmin) {
                navigate("/admin", { replace: true });
            } else {
                navigate("/", { replace: true });
            }
        }
    }, [loading, appUser, availableTenants, navigate]);

    return (

        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4 pt-16">
            <AnimatePresence mode="wait">
                {!success ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        key="form"
                        className="w-full max-w-md"
                    >
                        <Card className="shadow-2xl border-primary/10 backdrop-blur-sm bg-card/95">
                            <CardHeader className="text-center space-y-6 pb-2">
                                <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-20 h-20 flex items-center justify-center ring-4 ring-primary/5">
                                    <Rocket className="w-10 h-10 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                                        Bienvenido a Kurso
                                    </CardTitle>
                                    <CardDescription className="text-lg text-muted-foreground/90">
                                        Configuremos tu espacio educativo.
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="space-y-3">
                                    <Label htmlFor="institutionName" className="text-base font-medium pl-1">
                                        ¿Cómo se llama tu Colegio?
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="institutionName"
                                            placeholder="Ej: Colegio San Agustín"
                                            value={institutionName}
                                            onChange={(e) => setInstitutionName(e.target.value)}
                                            className="h-14 text-lg pl-4 pr-10 shadow-sm transition-all focus:ring-2 focus:ring-primary/20"
                                            autoFocus
                                            disabled={loading}
                                        />
                                        <Sparkles className="absolute right-3 top-4 h-6 w-6 text-muted-foreground/30" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="courseName" className="text-base font-medium pl-1">
                                        ¿Cómo se llama tu Curso?
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="courseName"
                                            placeholder="Ej: 4to Medio A 2025"
                                            value={courseName}
                                            onChange={(e) => setCourseName(e.target.value)}
                                            className="h-14 text-lg pl-4 pr-10 shadow-sm transition-all focus:ring-2 focus:ring-primary/20"
                                            disabled={loading}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateCourse()}
                                        />
                                        <Sparkles className="absolute right-3 top-4 h-6 w-6 text-muted-foreground/30" />
                                    </div>
                                    <p className="text-sm text-muted-foreground pl-1">
                                        Tus alumnos verán estos nombres.
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="pb-8 pt-2">
                                <Button
                                    className="w-full h-14 text-lg font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl"
                                    onClick={handleCreateCourse}
                                    disabled={loading || !courseName.trim() || !institutionName.trim()}
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            <span>Configurando Plataforma...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span>Comenzar Ahora</span>
                                            <Rocket className="h-5 w-5" />
                                        </div>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key="success"
                        className="text-center space-y-6"
                    >
                        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-50 dark:ring-green-900/10">
                            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-foreground">¡Todo Listo!</h2>
                            <p className="text-muted-foreground text-lg max-w-xs mx-auto">
                                Tu curso ha sido creado. Te estamos redirigiendo a tu panel...
                            </p>
                        </div>
                        <div className="flex justify-center pt-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
