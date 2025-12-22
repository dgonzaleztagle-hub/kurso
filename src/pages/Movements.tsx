import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatDateForDB, parseDateFromDB } from "@/lib/dateUtils";

type MovementType = "ingreso" | "egreso" | null;
type IncomeType = "actividad" | "cuota_mensual" | "otros" | null;

interface Activity {
  id: number;
  name: string;
  amount: number;
}

export default function Movements() {
  const [movementType, setMovementType] = useState<MovementType>(null);
  const [loading, setLoading] = useState(false);

  // Common fields
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(formatDateForDB(new Date()));

  // Income fields
  const [incomeType, setIncomeType] = useState<IncomeType>(null);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [concept, setConcept] = useState("");
  const [customConcept, setCustomConcept] = useState("");
  const [incomeGlosas, setIncomeGlosas] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [students, setStudents] = useState<Array<{ id: number, name: string }>>([]);
  const [pendingMonths, setPendingMonths] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Expense fields
  const [supplier, setSupplier] = useState("");
  const [customSupplier, setCustomSupplier] = useState("");
  const [expenseConcept, setExpenseConcept] = useState("");
  const [existingSuppliers, setExistingSuppliers] = useState<string[]>([]);

  useEffect(() => {
    loadIncomeGlosas();
    loadExistingSuppliers();
    loadActivities();
    loadStudents();
  }, []);

  const loadIncomeGlosas = async () => {
    const { data } = await supabase
      .from("payments")
      .select("concept")
      .neq("concept", "CUOTA MENSUAL");

    if (data) {
      const uniqueGlosas = Array.from(new Set(data.map(p => p.concept).filter(Boolean)));
      setIncomeGlosas(uniqueGlosas);
    }
  };

  const loadActivities = async () => {
    const { data } = await supabase
      .from("activities")
      .select("id, name, amount")
      .order("name");

    if (data) {
      setActivities(data);
    }
  };

  const loadStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .order("last_name");

    if (data) {
      setStudents(data.map(s => ({
        id: s.id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Sin Nombre'
      })));
    }
  };

  const loadExistingSuppliers = async () => {
    // Cast to any to bypass outdated types.ts which assumes 'supplier' column exists
    const { data } = await supabase
      .from("expenses")
      .select("category" as any);

    if (data) {
      // Cast data to any[] to access the dynamic column
      const uniqueSuppliers = Array.from(new Set((data as any[]).map(e => e.category).filter(Boolean)));
      setExistingSuppliers(uniqueSuppliers);
    }
  };

  const resetForm = () => {
    setAmount("");
    setDate(formatDateForDB(new Date()));
    setIncomeType(null);
    setStudentId("");
    setStudentName("");
    setConcept("");
    setCustomConcept("");
    setSelectedActivity("");
    setPendingMonths([]);
    setSelectedMonths([]);
    setSupplier("");
    setCustomSupplier("");
    setExpenseConcept("");
  };

  const loadPendingMonths = async (selectedStudentId: string) => {
    const MONTHLY_FEE = 3000;
    const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

    // Obtener fecha de matrícula del estudiante
    const { data: studentData } = await supabase
      .from('students')
      .select('enrollment_date')
      .eq('id', parseInt(selectedStudentId))
      .single();

    if (!studentData) return;

    const enrollmentDate = parseDateFromDB(studentData.enrollment_date);
    const enrollmentMonth = enrollmentDate.getMonth();
    const enrollmentYear = enrollmentDate.getFullYear();
    const currentYear = new Date().getFullYear();

    // Determinar el primer mes a pagar (marzo = 2, o mes de matrícula si es posterior)
    const startMonth = 2; // Marzo
    let firstPayableMonth = startMonth;

    if (enrollmentYear === currentYear && enrollmentMonth > startMonth) {
      firstPayableMonth = enrollmentMonth;
    }

    // Obtener pagos de cuotas y movimientos de crédito negativos
    const { data: previousPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('student_id', parseInt(selectedStudentId))
      .or('concept.ilike.%cuota%,concept.ilike.%CUOTA%');

    const { data: creditMovements } = await supabase
      .from('credit_movements')
      .select('amount')
      .eq('student_id', parseInt(selectedStudentId))
      .eq('type', 'payment_redirect')
      .lt('amount', 0);

    // Calcular total pagado
    const totalPreviousPaid = (previousPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const totalCreditRedirects = (creditMovements || []).reduce((sum, m) => sum + Math.abs(Number(m.amount)), 0);
    const totalPaid = totalPreviousPaid + totalCreditRedirects;
    const monthsAlreadyPaid = Math.floor(totalPaid / MONTHLY_FEE);

    // Calcular meses pendientes
    const pending: string[] = [];
    for (let i = firstPayableMonth; i <= 11; i++) { // Hasta diciembre (índice 11)
      if (i - firstPayableMonth >= monthsAlreadyPaid) {
        pending.push(monthNames[i]);
      }
    }

    setPendingMonths(pending);
    setSelectedMonths([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementType) return;

    setLoading(true);
    try {
      if (movementType === "ingreso") {
        // Get next folio for payment
        const { data: folioData } = await supabase.rpc("get_next_payment_folio");
        const folio = folioData || 1;

        let finalConcept = "";
        let monthPeriod = null;

        if (incomeType === "actividad") {
          finalConcept = activities.find(a => a.id.toString() === selectedActivity)?.name || "";
        } else if (incomeType === "cuota_mensual") {
          // Generar concepto basado en meses seleccionados
          if (selectedMonths.length === 1) {
            finalConcept = `Cuota ${selectedMonths[0]}`;
            monthPeriod = selectedMonths[0];
          } else if (selectedMonths.length > 1) {
            finalConcept = `Cuota ${selectedMonths[0]}-${selectedMonths[selectedMonths.length - 1]}`;
            monthPeriod = `${selectedMonths[0]}-${selectedMonths[selectedMonths.length - 1]}`;
          }
        } else {
          finalConcept = concept === "OTRO" ? customConcept : concept;
        }

        const insertData: any = {
          folio,
          student_id: studentId ? parseInt(studentId) : null,
          student_name: studentName,
          payment_date: date,
          amount: parseFloat(amount),
          concept: finalConcept,
        };

        if (incomeType === "actividad" && selectedActivity) {
          insertData.activity_id = parseInt(selectedActivity);
        }

        if (monthPeriod) {
          insertData.month_period = monthPeriod;
        }

        const { error } = await supabase.from("payments").insert(insertData);

        if (error) throw error;
        toast.success(`Ingreso registrado con folio ${folio}`);
      } else {
        // Get next folio for expense
        const { data: folioData } = await supabase.rpc("get_next_expense_folio");
        const folio = folioData || 1;

        const finalSupplier = supplier === "NUEVO" ? customSupplier : supplier;

        // Try getting tenant_id if possible, otherwise rely on backend trigger/default
        // The migration mentioned NOT NULL but didn't show DEFAULT. If trigger fails, this might fail.
        // Let's safe-guard by calling getUser if needed, but previously we just wanted to fix columns.
        let tenantId = undefined;
        try {
          const { data } = await supabase.auth.getUser();
          tenantId = data.user?.user_metadata?.tenant_id;
        } catch (e) {
          // ignore
        }

        // Explicitly cast to 'any' to bypass outdated TypeScript definitions
        // Database actually requires: category, description (not supplier, concept)
        const insertPayload: any = {
          folio,
          tenant_id: tenantId,
          category: finalSupplier,
          expense_date: date,
          amount: parseFloat(amount),
          description: expenseConcept,
        };

        const { error } = await supabase.from("expenses").insert(insertPayload);

        if (error) throw error;
        toast.success(`Egreso registrado con folio ${folio}`);
      }

      resetForm();
      loadIncomeGlosas();
      loadExistingSuppliers();
    } catch (error) {
      console.error("Error al registrar movimiento:", error);
      toast.error("Error al registrar el movimiento");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (!movementType || !amount || !date) return false;

    if (movementType === "ingreso") {
      if (!incomeType) return false;

      if (incomeType === "actividad") {
        return selectedActivity.trim() !== "" && studentId.trim() !== "";
      } else if (incomeType === "cuota_mensual") {
        return studentId.trim() !== "" && selectedMonths.length > 0;
      } else {
        const finalConcept = concept === "OTRO" ? customConcept : concept;
        return studentName.trim() !== "" && finalConcept.trim() !== "";
      }
    } else {
      const finalSupplier = supplier === "NUEVO" ? customSupplier : supplier;
      return finalSupplier.trim() !== "" && expenseConcept.trim() !== "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Registrar Movimiento</h1>
        <p className="text-muted-foreground">
          Registra ingresos y egresos en un solo lugar
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecciona el Tipo de Movimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Button
              type="button"
              variant={movementType === "ingreso" ? "default" : "outline"}
              className="h-24 flex flex-col gap-2"
              onClick={() => setMovementType("ingreso")}
            >
              <ArrowUpCircle className="h-8 w-8" />
              <span>Ingreso</span>
            </Button>
            <Button
              type="button"
              variant={movementType === "egreso" ? "default" : "outline"}
              className="h-24 flex flex-col gap-2"
              onClick={() => setMovementType("egreso")}
            >
              <ArrowDownCircle className="h-8 w-8" />
              <span>Egreso</span>
            </Button>
          </div>

          {movementType && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Monto</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              {movementType === "ingreso" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="incomeType">Tipo de Ingreso</Label>
                    <Select
                      value={incomeType || ""}
                      onValueChange={(value: IncomeType) => {
                        setIncomeType(value);
                        setStudentId("");
                        setStudentName("");
                        setSelectedActivity("");
                        setConcept("");
                        setCustomConcept("");
                        setAmount("");
                        setPendingMonths([]);
                        setSelectedMonths([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de ingreso" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="actividad">Actividad</SelectItem>
                        <SelectItem value="cuota_mensual">Cuota Mensual</SelectItem>
                        <SelectItem value="otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {incomeType === "actividad" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="activity">Actividad</Label>
                        <Select value={selectedActivity} onValueChange={(value) => {
                          setSelectedActivity(value);
                          const activity = activities.find(a => a.id.toString() === value);
                          if (activity) {
                            setAmount(activity.amount.toString());
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una actividad" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {activities.map((activity) => (
                              <SelectItem key={activity.id} value={activity.id.toString()}>
                                {activity.name} - ${activity.amount.toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="student">Estudiante</Label>
                        <Select value={studentId} onValueChange={(value) => {
                          setStudentId(value);
                          const student = students.find(s => s.id.toString() === value);
                          if (student) {
                            setStudentName(student.name);
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el estudiante" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {students.map((student) => (
                              <SelectItem key={student.id} value={student.id.toString()}>
                                {student.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {incomeType === "cuota_mensual" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="student">Estudiante</Label>
                        <Select value={studentId} onValueChange={(value) => {
                          setStudentId(value);
                          const student = students.find(s => s.id.toString() === value);
                          if (student) {
                            setStudentName(student.name);
                            loadPendingMonths(value);
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el estudiante" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {students.map((student) => (
                              <SelectItem key={student.id} value={student.id.toString()}>
                                {student.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {pendingMonths.length > 0 && (
                        <div className="space-y-2">
                          <Label>Meses Pendientes</Label>
                          <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                            {pendingMonths.map((month) => (
                              <div key={month} className="flex items-center space-x-2">
                                <Checkbox
                                  id={month}
                                  checked={selectedMonths.includes(month)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedMonths([...selectedMonths, month]);
                                      const monthCount = selectedMonths.length + 1;
                                      setAmount((monthCount * 3000).toString());
                                    } else {
                                      const newMonths = selectedMonths.filter(m => m !== month);
                                      setSelectedMonths(newMonths);
                                      setAmount((newMonths.length * 3000).toString());
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={month}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {month}
                                </label>
                              </div>
                            ))}
                          </div>
                          {selectedMonths.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {selectedMonths.length} {selectedMonths.length === 1 ? 'mes' : 'meses'} seleccionado{selectedMonths.length === 1 ? '' : 's'}: ${(selectedMonths.length * 3000).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}

                      {studentId && pendingMonths.length === 0 && (
                        <p className="text-sm text-green-600">Este estudiante no tiene meses pendientes de pago.</p>
                      )}
                    </>
                  )}

                  {incomeType === "otros" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="studentName">Nombre del Estudiante/Persona</Label>
                        <Input
                          id="studentName"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="Nombre completo"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="concept">Concepto</Label>
                        <Select value={concept} onValueChange={setConcept}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona o escribe el concepto" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {incomeGlosas.map((glosa) => (
                              <SelectItem key={glosa} value={glosa}>
                                {glosa}
                              </SelectItem>
                            ))}
                            <SelectItem value="OTRO">Escribir manualmente...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {concept === "OTRO" && (
                        <div className="space-y-2">
                          <Label htmlFor="customConcept">Concepto Personalizado</Label>
                          <Input
                            id="customConcept"
                            value={customConcept}
                            onChange={(e) => setCustomConcept(e.target.value)}
                            placeholder="Escribe el concepto"
                            required
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Destinatario</Label>
                    <Select value={supplier} onValueChange={setSupplier}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona o escribe el destinatario" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {existingSuppliers.map((sup) => (
                          <SelectItem key={sup} value={sup}>
                            {sup}
                          </SelectItem>
                        ))}
                        <SelectItem value="NUEVO">Escribir nuevo destinatario...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {supplier === "NUEVO" && (
                    <div className="space-y-2">
                      <Label htmlFor="customSupplier">Nuevo Destinatario</Label>
                      <Input
                        id="customSupplier"
                        value={customSupplier}
                        onChange={(e) => setCustomSupplier(e.target.value)}
                        placeholder="Nombre del destinatario"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="expenseConcept">Concepto (Glosa)</Label>
                    <Input
                      id="expenseConcept"
                      value={expenseConcept}
                      onChange={(e) => setExpenseConcept(e.target.value)}
                      placeholder="Describe el concepto del egreso"
                      required
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !isFormValid()}
              >
                {loading ? "Registrando..." : `Registrar ${movementType === "ingreso" ? "Ingreso" : "Egreso"}`}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
