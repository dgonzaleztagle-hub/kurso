import { useCallback, useEffect, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface NewStudentFormState {
  first_name: string;
  last_name: string;
  rut: string;
}

interface CreateStudentAccountsResponse {
  created?: number;
  linked?: number;
  failed?: number;
  errors?: number;
}

type StudentRow = Pick<Tables<"students">, "id" | "first_name" | "last_name" | "enrollment_date" | "rut">;
type StudentInsert = Tables<"students">["Insert"];

export default function Students() {
  const { currentTenant } = useTenant();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Create Student State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newStudent, setNewStudent] = useState<NewStudentFormState>({
    first_name: "",
    last_name: "",
    rut: "",
  });
  const [createAccount, setCreateAccount] = useState(false); // Default to false (Manual Generation via Script)

  // Generate Accounts State
  const [generatingAccounts, setGeneratingAccounts] = useState(false);

  useEffect(() => {
    const filtered = students.filter((student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.rut && student.rut.includes(searchTerm))
    );
    setFilteredStudents(filtered);
  }, [searchTerm, students]);

  const getFriendlyStudentError = (error: unknown) => {
    const typedError = error as Partial<PostgrestError> & { message?: string };
    const message = String(typedError.message || "").toLowerCase();
    const details = String(typedError.details || "").toLowerCase();
    const hint = String(typedError.hint || "").toLowerCase();
    const combined = `${message} ${details} ${hint}`;

    if (
      typedError.code === "23505" ||
      combined.includes("students_rut_unique_idx") ||
      combined.includes("duplicate key value") ||
      combined.includes("unique constraint") && combined.includes("rut")
    ) {
      return "Ya existe un alumno con ese RUT. No se permiten duplicados.";
    }

    return typedError.message || "Error al agregar estudiante";
  };

  const loadStudents = useCallback(async () => {
    if (!currentTenant) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, enrollment_date, rut")
        .eq('tenant_id', currentTenant.id)
        .order("last_name", { ascending: true });

      if (error) throw error;

      const mappedStudents = ((data as StudentRow[] | null) || []).map((student) => ({
        id: student.id,
        name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Sin Nombre',
        rut: student.rut,
        enrollment_date: student.enrollment_date
      }));

      setStudents(mappedStudents);
      setFilteredStudents(mappedStudents);
    } catch (error: unknown) {
      console.error("Error loading students:", error);
      toast.error("Error al cargar estudiantes");
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  useEffect(() => {
    if (currentTenant) {
      void loadStudents();
    }
  }, [currentTenant, loadStudents]);

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
      const rutNormalized = cleanRutForDB(newStudent.rut).toUpperCase();

      // Prevent duplicate RUT globally (login identity must be unique)
      const { data: existingRutRow, error: existingRutError } = await supabase
        .from("students")
        .select("id, rut")
        .eq("rut", rutNormalized)
        .limit(1)
        .maybeSingle();

      if (existingRutError) throw existingRutError;
      if (existingRutRow) {
        toast.error("Ya existe un alumno con ese RUT. No se permiten duplicados.");
        setCreating(false);
        return;
      }

      // 1. Create Student
      const studentPayload: StudentInsert = {
        tenant_id: currentTenant.id,
        first_name: newStudent.first_name.trim(),
        last_name: newStudent.last_name.trim(),
        rut: rutNormalized,
        enrollment_date: new Date().toISOString().split('T')[0],
      };
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .insert(studentPayload)
        .select()
        .single();

      if (studentError) throw studentError;

      toast.success("Estudiante registrado");

      // 2. Create Account for this student only (same canonical logic as batch)
      if (createAccount && studentData) {
        try {
          toast.info("Generando cuenta de acceso...");
          const { data: authData } = await supabase.auth.getSession();
          const accessToken = authData.session?.access_token;
          if (!accessToken) throw new Error("Sesión no válida. Vuelva a iniciar sesión.");

          const { data: accountResult, error: fnError } = await supabase.functions.invoke('create-student-accounts', {
            body: {
              tenantId: currentTenant.id,
              studentId: studentData.id,
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          if (fnError) throw fnError;
          const failed = Number((accountResult as CreateStudentAccountsResponse | null)?.failed || 0);
          if (failed > 0) {
            throw new Error("No se pudo crear la cuenta del alumno");
          }
          toast.success("Cuenta de acceso creada exitosamente");
        } catch (accError: unknown) {
          console.error("Error creating account:", accError);
          toast.error("Estudiante creado, pero falló la generación de cuenta.");
        }
      }

      setDialogOpen(false);
      setNewStudent({ first_name: "", last_name: "", rut: "" });
      await loadStudents();

    } catch (error: unknown) {
      console.error(error);
      toast.error(getFriendlyStudentError(error));
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateAccounts = async () => {
    if (!currentTenant) return;
    setGeneratingAccounts(true);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      if (!accessToken) throw new Error("Sesión no válida. Vuelva a iniciar sesión.");

      // Batch and single-account creation are unified in edge function logic
      const { data, error } = await supabase.functions.invoke('create-student-accounts', {
        body: {
          tenantId: currentTenant.id,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;

      const result = data as CreateStudentAccountsResponse | null;
      const created = result?.created || 0;
      const linked = result?.linked || 0;
      const errors = result?.errors || 0;
      toast.success(`Proceso finalizado. Creadas: ${created}, vinculadas: ${linked}, errores: ${errors}.`);
      await loadStudents();
    } catch (error: unknown) {
      console.error("Error generating accounts:", error);
      toast.error("Error al generar cuentas.");
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
                  <p className="text-xs text-muted-foreground">Se usará para generar el usuario de acceso del alumno basado en RUT y su clave inicial.</p>
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



      <div className="rounded-lg border border-primary/25 bg-primary/10 p-4 flex gap-3 text-foreground text-sm">
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
                    <TableCell>{student.rut || <span className="text-muted-foreground italic">--</span>}</TableCell>
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
