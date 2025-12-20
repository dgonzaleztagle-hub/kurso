import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface NotificationManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Notification {
  id: string;
  message: string;
  created_at: string;
  is_active: boolean;
}

export function NotificationManagementDialog({ open, onOpenChange }: NotificationManagementDialogProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dashboard_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast.error("Error al cargar las notificaciones");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_notifications')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast.success("Notificación desactivada");
      loadNotifications();
    } catch (error) {
      console.error("Error deactivating notification:", error);
      toast.error("Error al desactivar la notificación");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Notificación eliminada");
      loadNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Error al eliminar la notificación");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Gestionar Notificaciones
          </DialogTitle>
          <DialogDescription>
            Visualiza y gestiona las notificaciones publicadas en el dashboard
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay notificaciones registradas
            </p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Card key={notification.id} className={notification.is_active ? "border-primary/20" : "opacity-60"}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm mb-2">{notification.message}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {format(new Date(notification.created_at), "dd 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full ${notification.is_active ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10 text-gray-600'}`}>
                            {notification.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {notification.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeactivate(notification.id)}
                          >
                            Desactivar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(notification.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
