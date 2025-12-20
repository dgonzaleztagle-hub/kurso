import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, UserPlus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateForDisplay } from "@/lib/dateUtils";
import { formatRut, validateRut, cleanRutForDB } from "@/lib/rutUtils";
import { StudentImport } from "@/components/StudentImport";
import { useTenant } from "@/contexts/TenantContext";

interface Student {
  id: number;
  name: string;
  rut: string | null;
  enrollment_date: string;
}

export default function Students() {
  const { currentTenant } = useTenant();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Create Student State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newStudent, setNewStudent] = useState({
    first_name: "",
    last_name: "",
    rut: "",
  });
  const [createAccount, setCreateAccount] = useState(false); // Default to false (Manual Generation via Script)

  // Generate Accounts State
  const [generatingAccounts, setGeneratingAccounts] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      loadStudents();
    }
  }, [currentTenant]);

  useEffect(() => {
    const filtered = students.filter((student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.rut && student.rut.includes(searchTerm))
    );
    setFilteredStudents(filtered);
  }, [searchTerm, students]);

  const loadStudents = async () => {
    if (!currentTenant) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, enrollment_date, rut")
        .eq('tenant_id', currentTenant.id)
        .order("last_name", { ascending: true });

      if (error) throw error;

      const mappedStudents = (data || []).map(s => ({
        id: s.id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Sin Nombre',
        rut: s.rut,
        enrollment_date: s.enrollment_date
      }));

      setStudents(mappedStudents);
      setFilteredStudents(mappedStudents);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Error al cargar estudiantes");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;

    // Validation
    if (!newStudent.first_name || !newStudent.last_name) {
      toast.error("Nombres y Apellidos son obligatorios");
      return;
    }

    if (newStudent.rut) {
      if (!validateRut(newStudent.rut)) {
        toast.error("RUT inválido. Verifique el dígito verificador.");
        return;
      }
    } else {
      toast.error("El RUT es obligatorio para la creación de cuenta.");
      return;
    }

    setCreating(true);
    try {
      // 1. Create Student
      const { data: studentData, error: studentError } = await supabase.from("students").insert([
        {
          tenant_id: currentTenant.id,
          first_name: newStudent.first_name.trim(),
          last_name: newStudent.last_name.trim(),
          rut: cleanRutForDB(newStudent.rut),
          enrollment_date: new Date().toISOString().split('T')[0], // Default today/year start
        },
      ] as any).select().single();

      if (studentError) throw studentError;

      toast.success("Estudiante registrado");

      // 2. Create Account (Optional but recommended)
      if (createAccount && studentData) {
        // We trigger the bulk creation function just for simplicity, or we could call a specific endpoint.
        // Since we don't have "create-single-student-account", we can either:
        // A) Call 'create-student-accounts' (it will find this new student and process it).
        // B) Implement single creation here.
        // Option A is easiest and consistent.
        try {
          toast.info("Generando cuenta de acceso...");
          const { error: fnError } = await supabase.functions.invoke('create-student-accounts', {
            body: { tenantId: currentTenant.id }
          });
          if (fnError) throw fnError;
          toast.success("Cuenta de acceso creada exitosamente");
        } catch (accError) {
          console.error("Error creating account:", accError);
          toast.error("Estudiante creado, pero falló la generación de cuenta.");
        }
      }

      setDialogOpen(false);
      setNewStudent({ first_name: "", last_name: "", rut: "" });
      loadStudents();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al agregar estudiante");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateAccounts = async () => {
    if (!currentTenant) return;
    setGeneratingAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-student-accounts', {
        body: { tenantId: currentTenant.id }
      });
      if (error) throw error;

      toast.success(`Proceso finalizado. Creadas: ${data.created}, Vinculadas: ${data.linked}, Omitidas: ${data.skipped}`);
    } catch (error: any) {
      console.error("Error generating accounts:", error);
      toast.error("Error al generar cuentas masivas");
    } finally {
      setGeneratingAccounts(false);
    }
  };

  if (loading && !students.length) return <div className="text-center py-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Alumnos</h1>
          <p className="text-muted-foreground">Administra matrículas y accesos para {currentTenant?.name}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleGenerateAccounts} disabled={generatingAccounts}>
            {generatingAccounts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Generar Cuentas Faltantes
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Alumno
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Nuevo Alumno
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Nombres</Label>
                    <Input
                      id="first_name"
                      placeholder="Ej. Juan Andrés"
                      value={newStudent.first_name}
                      onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Apellidos</Label>
                    <Input
                      id="last_name"
                      placeholder="Ej. Pérez González"
                      value={newStudent.last_name}
                      onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rut">RUT (12.345.678-9)</Label>
                  <Input
                    id="rut"
                    placeholder="12.345.678-9"
                    value={newStudent.rut}
                    onChange={(e) => {
                      // Auto format logic? Or just let user type and we validate on blur/submit?
                      // Simple format on change
                      const formatted = formatRut(e.target.value);
                      setNewStudent({ ...newStudent, rut: formatted });
                    }}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Se usará para generar el usuario (RUT@kurso.cl) y clave inicial.</p>
                </div>

                <div className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id="create_account"
                    checked={createAccount}
                    onCheckedChange={(checked) => setCreateAccount(checked === true)}
                  />
                  <Label htmlFor="create_account" className="font-medium">
                    Crear cuenta de acceso automática
                  </Label>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Registrar Alumno
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>



      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-blue-800 text-sm">
        <div className="mt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        </div>
        <div className="space-y-1">
          <p className="font-semibold">Información de Acceso para Alumnos</p>
          <p>
            Los alumnos pueden ingresar al portal usando su <strong>RUT</strong> (ej: 12.345.678-9).
            La <strong>contraseña inicial</strong> corresponde a los <strong>primeros 6 dígitos</strong> de su RUT (sin puntos).
            El sistema les obligará a cambiar su clave al primer ingreso.
          </p>
        </div>
      </div>

      <StudentImport onSuccess={loadStudents} tenantId={currentTenant?.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Directorio de Alumnos</CardTitle>
          <div className="flex items-center gap-2 mt-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o RUT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No se encontraron alumnos" : "No hay alumnos registrados"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead>RUT</TableHead>
                  <TableHead>Fecha Matrícula</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium capitalize">{student.name.toLowerCase()}</TableCell>
                    <TableCell>{student.rut || <span className="text-gray-400 italic">--</span>}</TableCell>
                    <TableCell>
                      {formatDateForDisplay(student.enrollment_date)}
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