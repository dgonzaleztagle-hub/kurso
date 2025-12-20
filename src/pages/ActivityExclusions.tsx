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
  id: number | string;
  name: string;
  scheduled_date?: string;
  type: 'base' | 'scheduled';
}

interface BaseExclusion {
  id: number;
  student_id: number;
  activity_id: number;
  students: { name: string };
  activities: { name: string };
  type: 'base';
}

interface ScheduledExclusion {
  id: number;
  student_id: number;
  scheduled_activity_id: string;
  students: { name: string };
  scheduled_activities: { name: string; scheduled_date: string };
  type: 'scheduled';
}

type Exclusion = BaseExclusion | ScheduledExclusion;

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
      const [baseExclusionsRes, scheduledExclusionsRes, studentsRes, baseActivitiesRes, scheduledActivitiesRes] = await Promise.all([
        supabase
          .from("activity_exclusions")
          .select("*, students(name), activities(name)")
          .order("id", { ascending: false }),
        supabase
          .from("scheduled_activity_exclusions")
          .select("*, students(name), scheduled_activities(name, scheduled_date)")
          .order("id", { ascending: false }),
        supabase.from("students").select("id, name").order("name"),
        supabase.from("activities").select("id, name").order("name"),
        supabase.from("scheduled_activities").select("id, name, scheduled_date").order("scheduled_date", { ascending: false }),
      ]);

      if (baseExclusionsRes.error) throw baseExclusionsRes.error;
      if (scheduledExclusionsRes.error) throw scheduledExclusionsRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (baseActivitiesRes.error) throw baseActivitiesRes.error;
      if (scheduledActivitiesRes.error) throw scheduledActivitiesRes.error;

      // Combinar exclusiones de ambas tablas
      const combinedExclusions: Exclusion[] = [
        ...(baseExclusionsRes.data || []).map(e => ({ ...e, type: 'base' as const })),
        ...(scheduledExclusionsRes.data || []).map(e => ({ ...e, type: 'scheduled' as const })),
      ];

      // Combinar actividades de ambas tablas con prefijo para distinguirlas
      const combinedActivities: Activity[] = [
        ...(baseActivitiesRes.data || []).map(a => ({
          id: a.id,
          name: a.name,
          type: 'base' as const
        })),
        ...(scheduledActivitiesRes.data || []).map(a => ({
          id: a.id,
          name: `${a.name} - ${new Date(a.scheduled_date).toLocaleDateString('es-CL')}`,
          scheduled_date: a.scheduled_date,
          type: 'scheduled' as const
        }))
      ];

      setExclusions(combinedExclusions);
      setStudents(studentsRes.data || []);
      setActivities(combinedActivities);
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
      // Encontrar la actividad seleccionada para determinar su tipo
      const selectedActivity = activities.find(a => a.id.toString() === newExclusion.activity_id);
      
      if (!selectedActivity) {
        toast.error("Actividad no encontrada");
        return;
      }

      let error;
      
      if (selectedActivity.type === 'base') {
        // Insertar en activity_exclusions para actividades base
        const result = await supabase.from("activity_exclusions").insert({
          student_id: parseInt(newExclusion.student_id),
          activity_id: parseInt(newExclusion.activity_id),
        });
        error = result.error;
      } else {
        // Insertar en scheduled_activity_exclusions para actividades programadas
        const result = await supabase.from("scheduled_activity_exclusions").insert({
          student_id: parseInt(newExclusion.student_id),
          scheduled_activity_id: newExclusion.activity_id,
        });
        error = result.error;
      }

      if (error) {
        if (error.code === "23505") {
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

  const handleDeleteExclusion = async (exclusion: Exclusion) => {
    if (!confirm("¿Está seguro de eliminar esta exclusión?")) return;

    try {
      let error;
      
      if (exclusion.type === 'base') {
        const result = await supabase
          .from("activity_exclusions")
          .delete()
          .eq("id", exclusion.id);
        error = result.error;
      } else {
        const result = await supabase
          .from("scheduled_activity_exclusions")
          .delete()
          .eq("id", exclusion.id);
        error = result.error;
      }

      if (error) throw error;

      toast.success("Exclusión eliminada");
      loadData();
    } catch (error) {
      console.error("Error deleting exclusion:", error);
      toast.error("Error al eliminar exclusión");
    }
  };

  const getExclusionActivityName = (exclusion: Exclusion): string => {
    if (exclusion.type === 'base') {
      return exclusion.activities.name;
    } else {
      const date = new Date(exclusion.scheduled_activities.scheduled_date).toLocaleDateString('es-CL');
      return `${exclusion.scheduled_activities.name} - ${date}`;
    }
  };

  const getExclusionStudentName = (exclusion: Exclusion): string => {
    return exclusion.students.name;
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
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Actividades Base</div>
                        {activities.filter(a => a.type === 'base').map((activity) => (
                          <SelectItem key={`base-${activity.id}`} value={activity.id.toString()}>
                            {activity.name}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Actividades Programadas</div>
                        {activities.filter(a => a.type === 'scheduled').map((activity) => (
                          <SelectItem key={`scheduled-${activity.id}`} value={activity.id.toString()}>
                            {activity.name}
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
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exclusions.map((exclusion) => (
                      <TableRow key={`${exclusion.type}-${exclusion.id}`}>
                        <TableCell className="font-medium">
                          {getExclusionStudentName(exclusion)}
                        </TableCell>
                        <TableCell>{getExclusionActivityName(exclusion)}</TableCell>
                        <TableCell>
                          <Badge variant={exclusion.type === 'base' ? 'secondary' : 'outline'}>
                            {exclusion.type === 'base' ? 'Base' : 'Programada'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExclusion(exclusion)}
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
                  <Card key={`${exclusion.type}-${exclusion.id}`} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Estudiante</p>
                            <p className="font-medium text-sm">{getExclusionStudentName(exclusion)}</p>
                          </div>
                          <Badge variant={exclusion.type === 'base' ? 'secondary' : 'outline'} className="text-xs">
                            {exclusion.type === 'base' ? 'Base' : 'Programada'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Actividad</p>
                          <p className="text-sm">{getExclusionActivityName(exclusion)}</p>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteExclusion(exclusion)}
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
