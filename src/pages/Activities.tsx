import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Edit } from "lucide-react";
import { formatDateForDisplay } from "@/lib/dateUtils";

interface Activity {
  id: number;
  name: string;
  amount: number;
  activity_date: string | null;
  can_redirect_to_fees: boolean;
}

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [newActivity, setNewActivity] = useState({
    name: "",
    amount: "",
    activity_date: "",
    can_redirect_to_fees: false,
  });

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("activity_date", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error loading activities:", error);
      toast.error("Error al cargar actividades");
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newActivity.name || !newActivity.amount) {
      toast.error("Por favor complete todos los campos obligatorios");
      return;
    }

    try {
      const { error } = await supabase
        .from("activities")
        .insert({
          name: newActivity.name,
          amount: parseFloat(newActivity.amount),
          activity_date: newActivity.activity_date || null,
          can_redirect_to_fees: newActivity.can_redirect_to_fees,
        });

      if (error) throw error;

      toast.success("Actividad agregada exitosamente");
      setNewActivity({ name: "", amount: "", activity_date: "", can_redirect_to_fees: false });
      setOpen(false);
      loadActivities();
    } catch (error) {
      console.error("Error adding activity:", error);
      toast.error("Error al agregar actividad");
    }
  };

  const handleEditActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingActivity) return;

    try {
      const { error } = await supabase
        .from("activities")
        .update({
          name: editingActivity.name,
          amount: editingActivity.amount,
          activity_date: editingActivity.activity_date || null,
          can_redirect_to_fees: editingActivity.can_redirect_to_fees,
        })
        .eq("id", editingActivity.id);

      if (error) throw error;

      toast.success("Actividad actualizada exitosamente");
      setEditingActivity(null);
      setOpen(false);
      loadActivities();
    } catch (error) {
      console.error("Error updating activity:", error);
      toast.error("Error al actualizar actividad");
    }
  };

  const openEditDialog = (activity: Activity) => {
    setEditingActivity(activity);
    setOpen(true);
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingActivity(null);
      setNewActivity({ name: "", amount: "", activity_date: "", can_redirect_to_fees: false });
    }
  };

  const handleDeleteActivity = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta actividad?")) return;

    try {
      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Actividad eliminada");
      loadActivities();
    } catch (error) {
      console.error("Error deleting activity:", error);
      toast.error("Error al eliminar actividad");
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Gestión de Actividades</h1>
        <p className="text-muted-foreground">
          Administre las actividades y sus valores de cuota
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Actividades</CardTitle>
              <CardDescription>Lista de todas las actividades registradas</CardDescription>
            </div>
            <Dialog open={open} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button>Nueva Actividad</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingActivity ? "Editar Actividad" : "Agregar Nueva Actividad"}</DialogTitle>
                  <DialogDescription>
                    {editingActivity ? "Modifique los datos de la actividad" : "Ingrese los datos de la nueva actividad"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={editingActivity ? handleEditActivity : handleAddActivity} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nombre de la Actividad *</Label>
                    <Input
                      id="name"
                      value={editingActivity ? editingActivity.name : newActivity.name}
                      onChange={(e) =>
                        editingActivity 
                          ? setEditingActivity({ ...editingActivity, name: e.target.value })
                          : setNewActivity({ ...newActivity, name: e.target.value })
                      }
                      placeholder="ACTIVIDAD ABUELITOS"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Monto *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={editingActivity ? editingActivity.amount : newActivity.amount}
                      onChange={(e) =>
                        editingActivity 
                          ? setEditingActivity({ ...editingActivity, amount: parseFloat(e.target.value) })
                          : setNewActivity({ ...newActivity, amount: e.target.value })
                      }
                      placeholder="3000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="activity_date">Fecha (opcional)</Label>
                    <Input
                      id="activity_date"
                      type="date"
                      value={editingActivity ? (editingActivity.activity_date || "") : newActivity.activity_date}
                      onChange={(e) =>
                        editingActivity 
                          ? setEditingActivity({ ...editingActivity, activity_date: e.target.value })
                          : setNewActivity({ ...newActivity, activity_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="can_redirect"
                      checked={editingActivity ? editingActivity.can_redirect_to_fees : newActivity.can_redirect_to_fees}
                      onChange={(e) =>
                        editingActivity 
                          ? setEditingActivity({ ...editingActivity, can_redirect_to_fees: e.target.checked })
                          : setNewActivity({ ...newActivity, can_redirect_to_fees: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="can_redirect" className="text-sm">
                      ¿Se puede redirigir a cuotas si el alumno no asiste?
                    </Label>
                  </div>
                  <Button type="submit" className="w-full">
                    {editingActivity ? "Actualizar Actividad" : "Agregar Actividad"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando actividades...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay actividades registradas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.name}</TableCell>
                    <TableCell>${activity.amount.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, ".")}</TableCell>
                    <TableCell>
                      {activity.activity_date
                        ? formatDateForDisplay(activity.activity_date)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(activity)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteActivity(activity.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
