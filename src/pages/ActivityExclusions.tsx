import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, UserX } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: number;
  name: string;
}

interface Activity {
  id: number;
  name: string;
  activity_date?: string;
}

interface Exclusion {
  id: number;
  student_id: number;
  activity_id: number;
  students: { name: string };
  activities: { name: string; activity_date?: string };
}

export default function ActivityExclusions() {
  const navigate = useNavigate();
  const { userRole, hasPermission, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newExclusion, setNewExclusion] = useState({
    student_id: "",
    activity_id: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [exclusionsRes, studentsRes, activitiesRes] = await Promise.all([
        supabase
          .from("activity_exclusions")
          .select("*, students(first_name, last_name), activities(name, activity_date)")
          .order("id", { ascending: false }),
        supabase.from("students").select("id, first_name, last_name").order("last_name"),
        supabase.from("activities").select("id, name, activity_date").order("id", { ascending: false }),
      ]);

      if (exclusionsRes.error) throw exclusionsRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      // Mapear exclusiones
      const mappedExclusions: Exclusion[] = (exclusionsRes.data || []).map(e => ({
        id: e.id,
        student_id: e.student_id,
        activity_id: e.activity_id,
        students: {
          name: `${e.students?.first_name || ''} ${e.students?.last_name || ''}`.trim() || 'Sin Nombre'
        },
        activities: {
          name: e.activities?.name || 'Actividad Desconocida',
          activity_date: e.activities?.activity_date
        }
      }));

      // Mapear actividades
      const mappedActivities: Activity[] = (activitiesRes.data || []).map(a => ({
        id: a.id,
        name: a.name,
        activity_date: a.activity_date
      }));

      setExclusions(mappedExclusions);
      setStudents((studentsRes.data || []).map(s => ({
        id: s.id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Sin Nombre'
      })));
      setActivities(mappedActivities);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExclusion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newExclusion.student_id || !newExclusion.activity_id) {
      toast.error("Por favor seleccione estudiante y actividad");
      return;
    }

    try {
      const { error } = await supabase.from("activity_exclusions").insert({
        student_id: parseInt(newExclusion.student_id),
        activity_id: parseInt(newExclusion.activity_id),
      });

      if (error) {
        if (error.code === "23505") { // Unique constraint code
          toast.error("Esta exclusión ya existe");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Exclusión agregada exitosamente");
      setNewExclusion({ student_id: "", activity_id: "" });
      setOpen(false);
      loadData();
    } catch (error) {
      console.error("Error adding exclusion:", error);
      toast.error("Error al agregar exclusión");
    }
  };

  const handleDeleteExclusion = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta exclusión?")) return;

    try {
      const { error } = await supabase
        .from("activity_exclusions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Exclusión eliminada");
      loadData();
    } catch (error) {
      console.error("Error deleting exclusion:", error);
      toast.error("Error al eliminar exclusión");
    }
  };

  const formatActivityName = (activity: Activity | Exclusion['activities']) => {
    if (activity.activity_date) {
      const date = new Date(activity.activity_date).toLocaleDateString('es-CL');
      return `${activity.name} (${date})`;
    }
    return activity.name;
  };

  return (
    <div className="container mx-auto py-4 md:py-8 px-4">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">Exclusiones de Actividades</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Gestione qué estudiantes están excluidos de ciertas actividades
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-lg md:text-xl">Exclusiones</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Lista de estudiantes excluidos de actividades
              </CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size={isMobile ? "sm" : "default"}>
                  <UserX className="h-4 w-4 mr-2" />
                  Nueva Exclusión
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-lg md:text-xl">Agregar Exclusión</DialogTitle>
                  <DialogDescription className="text-xs md:text-sm">
                    Seleccione el estudiante y la actividad de la cual será excluido
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddExclusion} className="space-y-3 md:space-y-4">
                  <div>
                    <Label htmlFor="student" className="text-sm">Estudiante</Label>
                    <Select
                      value={newExclusion.student_id}
                      onValueChange={(value) =>
                        setNewExclusion({ ...newExclusion, student_id: value })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Seleccione un estudiante" />
                      </SelectTrigger>
                      <SelectContent className="bg-background max-h-[250px] md:max-h-[300px] overflow-y-auto">
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            {student.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="activity" className="text-sm">Actividad</Label>
                    <Select
                      value={newExclusion.activity_id}
                      onValueChange={(value) =>
                        setNewExclusion({ ...newExclusion, activity_id: value })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Seleccione una actividad" />
                      </SelectTrigger>
                      <SelectContent className="bg-background max-h-[250px] md:max-h-[300px] overflow-y-auto">
                        {activities.map((activity) => (
                          <SelectItem key={activity.id} value={activity.id.toString()}>
                            {formatActivityName(activity)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" size={isMobile ? "sm" : "default"}>
                    Agregar Exclusión
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          {loading ? (
            <div className="text-center py-8 text-sm">Cargando exclusiones...</div>
          ) : exclusions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No hay exclusiones registradas
            </div>
          ) : (
            <>
              {/* Vista Desktop - Tabla */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Actividad</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exclusions.map((exclusion) => (
                      <TableRow key={exclusion.id}>
                        <TableCell className="font-medium">
                          {exclusion.students.name}
                        </TableCell>
                        <TableCell>{formatActivityName(exclusion.activities)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExclusion(exclusion.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Vista Móvil - Cards */}
              <div className="md:hidden space-y-3">
                {exclusions.map((exclusion) => (
                  <Card key={exclusion.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Estudiante</p>
                            <p className="font-medium text-sm">{exclusion.students.name}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Actividad</p>
                          <p className="text-sm">{formatActivityName(exclusion.activities)}</p>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteExclusion(exclusion.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1.5" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
