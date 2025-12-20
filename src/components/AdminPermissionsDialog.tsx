import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type AppModule = 'dashboard' | 'students' | 'income' | 'expenses' | 'debt_reports' | 'payment_reports' | 'balance' | 'import' | 'movements' | 'activities' | 'activity_exclusions' | 'activity_payments' | 'monthly_fees' | 'payment_notifications' | 'reimbursements' | 'scheduled_activities' | 'student_profile' | 'credit_management' | 'credit_movements';

interface AdminPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const MODULE_LABELS: Record<AppModule, string> = {
  dashboard: "Dashboard",
  students: "Alumnos",
  income: "Ingresos",
  expenses: "Egresos",
  debt_reports: "Informes de Deudas",
  payment_reports: "Informes de Pagos",
  balance: "Balance",
  import: "Importar Datos",
  movements: "Registrar Movimientos",
  activities: "Actividades",
  activity_exclusions: "Exclusiones de Actividades",
  activity_payments: "Estado de Pagos",
  monthly_fees: "Cuotas Mensuales",
  payment_notifications: "Notificaciones de Pago",
  reimbursements: "Rendiciones",
  scheduled_activities: "Actividades Programadas",
  student_profile: "Perfil del Estudiante",
  credit_management: "Gestión de Créditos",
  credit_movements: "Movimientos de Crédito"
};

export function AdminPermissionsDialog({ open, onOpenChange, userId, userName }: AdminPermissionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<AppModule[]>([]);

  useEffect(() => {
    if (open && userId) {
      loadPermissions();
    }
  }, [open, userId]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('admin_permissions')
        .select('module')
        .eq('user_id', userId);

      if (error) throw error;

      // admin_permissions now stores DENIED modules (restrictions)
      const deniedModules = data?.map((p: any) => p.module as AppModule) || [];
      
      // Show all modules as checked except the denied ones
      const allModulesList = Object.keys(MODULE_LABELS) as AppModule[];
      const allowedModules = allModulesList.filter(m => !deniedModules.includes(m));
      
      setPermissions(allowedModules);
    } catch (error: any) {
      console.error("Error loading permissions:", error);
      toast.error("Error al cargar permisos");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (module: AppModule) => {
    setPermissions(prev => 
      prev.includes(module) 
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing permissions
      const { error: deleteError } = await (supabase as any)
        .from('admin_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Calculate denied modules (unchecked ones)
      const allModulesList = Object.keys(MODULE_LABELS) as AppModule[];
      const deniedModules = allModulesList.filter(m => !permissions.includes(m));

      // Insert denied modules as restrictions
      if (deniedModules.length > 0) {
        const { error: insertError } = await (supabase as any)
          .from('admin_permissions')
          .insert(deniedModules.map(module => ({
            user_id: userId,
            module
          })));

        if (insertError) throw insertError;
      }

      toast.success("Permisos actualizados correctamente");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast.error("Error al guardar permisos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Permisos - {userName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Por defecto, los administradores tienen acceso a todos los módulos. 
              Desmarca los módulos a los que NO quieres que este administrador tenga acceso:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(MODULE_LABELS) as AppModule[]).map(module => (
                <div key={module} className="flex items-center space-x-2">
                  <Checkbox
                    id={module}
                    checked={permissions.includes(module)}
                    onCheckedChange={() => handleTogglePermission(module)}
                  />
                  <Label
                    htmlFor={module}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {MODULE_LABELS[module]}
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Permisos"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
