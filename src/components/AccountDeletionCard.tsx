import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type ErrorShape = {
  message?: string;
};

interface AccountDeletionCardProps {
  compact?: boolean;
}

export function AccountDeletionCard({ compact = false }: AccountDeletionCardProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handleDeleteAccount = async () => {
    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("delete-my-account", {
        body: {},
      });

      if (error) {
        throw error;
      }

      if (data?.requiresOwnershipTransfer) {
        toast.error("Debes transferir la propiedad del curso antes de eliminar tu cuenta.");
        return;
      }

      toast.success("Tu cuenta fue eliminada correctamente.");

      try {
        await signOut();
      } catch (_error) {
        // Best effort after auth deletion.
      }

      navigate("/auth", { replace: true });
    } catch (error: unknown) {
      toast.error((error as ErrorShape)?.message || "No se pudo eliminar la cuenta.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className={`border-red-200/60 bg-red-50/70 p-5 dark:border-red-900/60 dark:bg-red-950/20 ${compact ? "" : "shadow-sm"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/40 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Eliminar cuenta</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Este proceso elimina el acceso a tu cuenta y anonimiza datos sensibles como correo,
              telefono y RUT cuando corresponde. Los registros contables del curso se conservan
              solo en la medida necesaria para continuidad financiera y auditoria.
            </p>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>La accion es irreversible.</li>
            <li>Si tu cuenta es owner de un curso, primero debes transferir la propiedad.</li>
            <li>Si necesitas ejercer derechos ARCO sin cerrar la cuenta, usa Soporte.</li>
          </ul>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Eliminar mi cuenta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará tu acceso y se anonimizarán los datos personales vinculados a tu
                  perfil cuando corresponda. Los registros contables que deban mantenerse por
                  continuidad del curso no se borrarán del libro operativo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void handleDeleteAccount();
                  }}
                  disabled={processing}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {processing ? "Eliminando..." : "Confirmar eliminación"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
