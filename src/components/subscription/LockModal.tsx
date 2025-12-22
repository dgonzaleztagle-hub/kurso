import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"

interface LockModalProps {
    isOpen: boolean
    isGracePeriod: boolean
}

export function LockModal({ isOpen, isGracePeriod }: LockModalProps) {
    // Prevent closing by clicking outside or escape (force user to interact)
    const handleInteractOutside = (e: Event) => {
        e.preventDefault()
    }

    return (
        <Dialog open={isOpen}>
            <DialogContent
                className="sm:max-w-md [&>button]:hidden" // Hide close button
                onInteractOutside={handleInteractOutside}
                onEscapeKeyDown={handleInteractOutside}
            >
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-center text-red-600">
                        ¡Periodo de prueba terminado!
                    </DialogTitle>
                    <DialogDescription className="text-center pt-2 text-base">
                        Esperamos que hayas disfrutado de la experiencia.
                        Para continuar gestionando tu curso sin interrupciones, contáctanos para activar tu plan.
                    </DialogDescription>
                </DialogHeader>

                {isGracePeriod && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 my-2 text-orange-800 text-sm text-center font-medium">
                        ⚠️ Tienes 3 días de gracia antes de que tu información sea eliminada permanentemente.
                    </div>
                )}

                <div className="flex flex-col gap-3 mt-4">
                    <Button
                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold h-12 text-lg"
                        onClick={() => window.open("https://wa.me/56972739105", "_blank")}
                    >
                        <MessageSquare className="mr-2 h-5 w-5" />
                        Contactar por WhatsApp
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                        Tu información está segura mientras regularizas tu cuenta.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
