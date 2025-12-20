import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface MassNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MassNotificationDialog({ open, onOpenChange }: MassNotificationDialogProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Por favor ingrese un mensaje");
      return;
    }

    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("No se pudo obtener el usuario actual");
        setSending(false);
        return;
      }

      // Crear notificación en el dashboard
      const { error } = await supabase
        .from('dashboard_notifications')
        .insert({
          message: message.trim(),
          created_by: user.id,
          is_active: true
        });

      if (error) throw error;

      toast.success("Notificación publicada en el dashboard de todos los alumnos");
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending mass notification:", error);
      toast.error("Error al publicar la notificación");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Publicar Notificación al Dashboard
          </DialogTitle>
          <DialogDescription>
            Esta notificación será visible para todos los apoderados en su dashboard hasta que la desactives manualmente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              placeholder="Escriba su mensaje aquí..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim()}
          >
            {sending ? "Enviando..." : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
