import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Users, DollarSign, PieChart, ShieldCheck, ArrowRight, Check, UserCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const steps = [
    {
        title: "¡Bienvenido a tu Panel!",
        description: "Tu espacio digital para gestionar las finanzas de tu curso sin estrés.",
        icon: ShieldCheck,
        color: "text-primary",
        bg: "bg-primary/10",
        content: "Aquí tendrás el control total. Olvídate de las planillas de excel desordenadas y los cobros manuales."
    },
    {
        title: "Gestiona tu Curso",
        description: "Mantén ordenada la lista de tus estudiantes y apoderados.",
        icon: Users,
        color: "text-blue-600",
        bg: "bg-blue-100 dark:bg-blue-900/20",
        content: "Registra a tus alumnos fácilmente y asigna a sus apoderados. El sistema mantendrá todo organizado por ti."
    },
    {
        title: "Control de Pagos y Deudas",
        description: "Visualiza quién ha pagado y quién debe en tiempo real.",
        icon: DollarSign,
        color: "text-green-600",
        bg: "bg-green-100 dark:bg-green-900/20",
        content: "Registra pagos de cuotas y actividades. El sistema calcula automáticamente las deudas y genera comprobantes."
    },
    {
        title: "Transparencia Total",
        description: "Cuentas claras conservan la amistad (y la confianza).",
        icon: PieChart,
        color: "text-purple-600",
        bg: "bg-purple-100 dark:bg-purple-900/20",
        content: "Tus apoderados tendrán su propio portal para ver sus pagos. Tú tendrás reportes detallados para rendir cuentas sin esfuerzo."
    },
    {
        title: "Completa tu Perfil",
        description: "Último paso: Necesitamos tus datos para personalizar tu experiencia.",
        icon: UserCircle,
        color: "text-orange-600",
        bg: "bg-orange-100 dark:bg-orange-900/20",
        content: "formulario", // Marker for rendering form
    }
];

export function WelcomeGuide() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { updateProfile, appUser } = useAuth();

    const [open, setOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    // Form States
    const [fullName, setFullName] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const isWelcome = searchParams.get("welcome") === "true";
        const hasSeenGuide = localStorage.getItem("has_seen_welcome_guide");

        if (isWelcome || !hasSeenGuide) {
            setOpen(true);
        }
    }, [searchParams]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // If it's the last step (Form), validate and save
            if (steps[currentStep].content === "formulario") {
                handleSubmitProfile();
            } else {
                handleClose();
            }
        }
    };

    const handleSubmitProfile = async () => {
        if (!fullName.trim() || !whatsapp.trim()) {
            toast.warning("Por favor completa todos los campos para continuar.");
            return;
        }

        setSaving(true);
        const { error } = await updateProfile({
            full_name: fullName,
            whatsapp_number: whatsapp
        });

        setSaving(false);

        if (error) {
            toast.error("Error al guardar perfil. Intenta de nuevo.");
        } else {
            toast.success("¡Perfil completado! Bienvenido.");
            handleClose();
        }
    };

    const handleClose = () => {
        setOpen(false);
        localStorage.setItem("has_seen_welcome_guide", "true");
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("welcome");
        navigate({ search: newParams.toString() }, { replace: true });
    };

    const StepIcon = steps[currentStep].icon;
    const isFormStep = steps[currentStep].content === "formulario";

    return (
        <Dialog open={open} onOpenChange={(open) => !open && !isFormStep && handleClose()}>
            {/* Prevent closing on form step if clicking outside is handled by modal prop generally, but here we control via onOpenChange */}
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0 border-0 shadow-2xl" onInteractOutside={(e) => isFormStep && e.preventDefault()}>
                <div className={`h-2 w-full transition-all duration-300 ease-in-out bg-gradient-to-r from-primary to-purple-600`} style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />

                <div className="p-6 md:p-8 space-y-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6 text-center"
                        >
                            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${steps[currentStep].bg} mb-4`}>
                                <StepIcon className={`w-10 h-10 ${steps[currentStep].color}`} />
                            </div>

                            <div className="space-y-2">
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    {steps[currentStep].title}
                                </DialogTitle>
                                <DialogDescription className="text-lg text-muted-foreground font-medium">
                                    {steps[currentStep].description}
                                </DialogDescription>
                            </div>

                            {isFormStep ? (
                                <div className="space-y-4 text-left pt-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="fullname">Nombre y Apellido</Label>
                                        <Input
                                            id="fullname"
                                            placeholder="Ej: María Pérez"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp">WhatsApp de Contacto</Label>
                                        <Input
                                            id="whatsapp"
                                            placeholder="+569 1234 5678"
                                            value={whatsapp}
                                            onChange={(e) => setWhatsapp(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Lo usaremos para recuperar tu cuenta y enviarte notificaciones importantes.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted-foreground leading-relaxed">
                                    {steps[currentStep].content}
                                </p>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex items-center justify-between pt-4">
                        <div className="flex gap-1">
                            {steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-2 w-2 rounded-full transition-colors ${idx === currentStep ? "bg-primary" : "bg-muted"}`}
                                />
                            ))}
                        </div>
                        <Button
                            onClick={handleNext}
                            disabled={isFormStep && saving}
                            className="gap-2 pl-6 pr-6 h-11 text-base rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30"
                        >
                            {isFormStep ? (
                                saving ? (
                                    <>Guardando... <Loader2 className="w-4 h-4 animate-spin" /></>
                                ) : (
                                    <>¡Listo! <Check className="w-4 h-4" /></>
                                )
                            ) : (
                                <>Siguiente <ArrowRight className="w-4 h-4" /></>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
