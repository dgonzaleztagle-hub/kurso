import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";

const MONTH_OPTIONS = [
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
] as const;

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  rut: string | null;
};

type OpeningBalanceRow = {
  id: string;
  folio: number;
  amount: number;
  effective_date: string;
  notes: string | null;
  status: string;
};

type HistoricalPaymentImportRow = {
  student_rut?: string;
  student_name?: string;
  month_period: string;
  amount: number | string;
  payment_date?: string;
  concept?: string;
};

type PostgrestErrorLike = { code?: string; message?: string };
type OpeningBalanceInsert = {
  tenant_id: string;
  folio: number;
  amount: number;
  effective_date: string;
  notes: string | null;
  created_by: string;
};
type PaymentInsert = TablesInsert<"payments">;
type CreditMovementInsert = TablesInsert<"credit_movements">;

const isMissingPaymentsCreatedByColumn = (error: unknown) =>
  (error as PostgrestErrorLike | undefined)?.code === "PGRST204" &&
  typeof (error as PostgrestErrorLike | undefined)?.message === "string" &&
  ((error as PostgrestErrorLike).message?.includes("'created_by'")) &&
  ((error as PostgrestErrorLike).message?.includes("'payments'"));

export default function HistoricalSetup() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOpening, setSavingOpening] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingCredit, setSavingCredit] = useState(false);
  const [importing, setImporting] = useState(false);

  const [openingAmount, setOpeningAmount] = useState("");
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split("T")[0]);
  const [openingNotes, setOpeningNotes] = useState("");

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [paymentMonth, setPaymentMonth] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentConcept, setPaymentConcept] = useState("");

  const [creditStudentId, setCreditStudentId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");

  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "es"),
      ),
    [students],
  );

  const loadData = useCallback(async () => {
    if (!currentTenant?.id) return;
    try {
      setLoading(true);
      const [studentsResult, openingResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, last_name, rut")
          .eq("tenant_id", currentTenant.id)
          .order("last_name"),
        supabase
          .from("tenant_opening_balances")
          .select("*")
          .eq("tenant_id", currentTenant.id)
          .order("effective_date", { ascending: false }),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (openingResult.error) throw openingResult.error;

      setStudents((studentsResult.data || []) as StudentRow[]);
      setOpeningBalances(((openingResult.data || []) as OpeningBalanceRow[]).filter((row) => row.status !== "reversed"));
    } catch (error) {
      console.error("Error loading historical setup:", error);
      toast.error("No se pudo cargar la configuración histórica");
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    if (currentTenant?.id) {
      void loadData();
    }
  }, [currentTenant?.id, loadData]);

  const getStudentName = (studentId: string) => {
    const student = sortedStudents.find((item) => String(item.id) === String(studentId));
    return student ? `${student.first_name} ${student.last_name}`.trim() : "";
  };

  const createOpeningBalance = async () => {
    if (!currentTenant?.id || !user?.id) return;
    const amount = Number(openingAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Ingrese un saldo inicial válido");
      return;
    }

    try {
      setSavingOpening(true);
      const { data: folio, error: folioError } = await supabase.rpc("get_next_payment_folio_for_tenant", {
        target_tenant_id: currentTenant.id,
      });
      if (folioError) throw folioError;

      const openingBalance: OpeningBalanceInsert = {
        tenant_id: currentTenant.id,
        folio: folio || 1,
        amount,
        effective_date: openingDate,
        notes: openingNotes.trim() || null,
        created_by: user.id,
      };
      const { error } = await supabase.from("tenant_opening_balances").insert(openingBalance);
      if (error) throw error;

      toast.success("Saldo inicial registrado");
      setOpeningAmount("");
      setOpeningNotes("");
      await loadData();
    } catch (error: unknown) {
      console.error("Error creating opening balance:", error);
      toast.error((error as PostgrestErrorLike).message || "No se pudo registrar el saldo inicial");
    } finally {
      setSavingOpening(false);
    }
  };

  const createHistoricalPayment = async (payload?: Partial<HistoricalPaymentImportRow> & { studentId?: string }) => {
    if (!currentTenant?.id || !user?.id) return;

    const studentId = payload?.studentId || selectedStudentId;
    const month = String(payload?.month_period || paymentMonth).trim().toUpperCase();
    const amount = Number(payload?.amount ?? paymentAmount);
    const date = String(payload?.payment_date || paymentDate || new Date().toISOString().split("T")[0]);
    const studentName = getStudentName(studentId);
    const concept = String(payload?.concept || paymentConcept || `Cuota ${month}`).trim();

    if (!studentId || !studentName) throw new Error("Debe seleccionar un alumno válido");
    if (!MONTH_OPTIONS.includes(month as (typeof MONTH_OPTIONS)[number])) {
      throw new Error("Debe seleccionar un mes válido");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Debe ingresar un monto válido");
    }

    const { data: folio, error: folioError } = await supabase.rpc("get_next_payment_folio_for_tenant", {
      target_tenant_id: currentTenant.id,
    });
    if (folioError) throw folioError;

    const paymentInsert: PaymentInsert & { created_by?: string | null } = {
      tenant_id: currentTenant.id,
      folio: folio || 1,
      student_id: String(studentId),
      student_name: studentName,
      payment_date: date,
      amount,
      concept,
      month_period: month,
      created_by: user.id,
    };

    const { error } = await supabase.from("payments").insert(paymentInsert);
    if (error && isMissingPaymentsCreatedByColumn(error)) {
      const { created_by: _ignored, ...fallbackInsert } = paymentInsert;
      const { error: fallbackError } = await supabase.from("payments").insert(fallbackInsert);
      if (fallbackError) throw fallbackError;
      return;
    }
    if (error) throw error;
  };

  const handleCreateHistoricalPayment = async () => {
    try {
      setSavingPayment(true);
      await createHistoricalPayment();
      toast.success("Pago histórico registrado");
      setSelectedStudentId("");
      setPaymentMonth("");
      setPaymentAmount("");
      setPaymentConcept("");
    } catch (error: unknown) {
      console.error("Error creating historical payment:", error);
      toast.error((error as PostgrestErrorLike).message || "No se pudo registrar el pago histórico");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleCreatePreviousCredit = async () => {
    if (!currentTenant?.id || !user?.id) return;
    const amount = Number(creditAmount);
    if (!creditStudentId) {
      toast.error("Debe seleccionar un alumno");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Debe ingresar un monto válido");
      return;
    }

    try {
      setSavingCredit(true);
      const creditMovement: CreditMovementInsert = {
        tenant_id: currentTenant.id,
        student_id: String(creditStudentId),
        amount,
        type: "manual_adjustment",
        description: creditDescription.trim() || "Saldo a favor previo a la app",
        details: {
          source: "historical_setup",
          kind: "previous_credit",
        },
        created_by: user.id,
      };
      const { error } = await supabase.from("credit_movements").insert(creditMovement);
      if (error) throw error;

      const { error: recomputeError } = await supabase.rpc("recompute_student_credit_balance", {
        p_tenant_id: currentTenant.id,
        p_student_id: String(creditStudentId),
      });
      if (recomputeError) throw recomputeError;

      toast.success("Saldo a favor previo registrado");
      setCreditStudentId("");
      setCreditAmount("");
      setCreditDescription("");
    } catch (error: unknown) {
      console.error("Error creating previous credit:", error);
      toast.error((error as PostgrestErrorLike).message || "No se pudo registrar el saldo a favor");
    } finally {
      setSavingCredit(false);
    }
  };

  const downloadTemplate = () => {
    const rows = [
      {
        student_rut: "12.345.678-9",
        student_name: "Nombre Alumno",
        month_period: "MARZO",
        amount: 3000,
        payment_date: "2026-03-01",
        concept: "Cuota MARZO",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PagosHistoricos");
    XLSX.writeFile(wb, "plantilla_pagos_historicos.xlsx");
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentTenant?.id) return;

    try {
      setImporting(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<HistoricalPaymentImportRow>(sheet);

      if (!rows.length) {
        toast.error("La planilla no contiene registros");
        return;
      }

      for (const row of rows) {
        const normalizedRut = String(row.student_rut || "").replace(/\./g, "").toUpperCase().trim();
        const student =
          sortedStudents.find((item) => String(item.rut || "").replace(/\./g, "").toUpperCase().trim() === normalizedRut) ||
          sortedStudents.find((item) => `${item.first_name} ${item.last_name}`.trim().toUpperCase() === String(row.student_name || "").trim().toUpperCase());

        if (!student) {
          throw new Error(`No se encontró alumno para ${row.student_rut || row.student_name || "fila sin alumno"}`);
        }

        await createHistoricalPayment({
          ...row,
          studentId: String(student.id),
        });
      }

      toast.success(`Se importaron ${rows.length} pagos históricos`);
      event.target.value = "";
    } catch (error: unknown) {
      console.error("Error importing historical payments:", error);
      toast.error((error as PostgrestErrorLike).message || "No se pudo importar la planilla");
    } finally {
      setImporting(false);
    }
  };

  const openingBalanceTotal = openingBalances.reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Carga Histórica</h1>
        <p className="text-muted-foreground">
          Registra el saldo inicial del curso y el historial previo por alumno sin contaminar los ingresos operacionales.
        </p>
      </div>

      <Tabs defaultValue="opening" className="space-y-6">
        <TabsList>
          <TabsTrigger value="opening">Saldo Inicial</TabsTrigger>
          <TabsTrigger value="payments">Pagos Históricos</TabsTrigger>
          <TabsTrigger value="credits">Saldos a Favor</TabsTrigger>
        </TabsList>

        <TabsContent value="opening" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurar Saldo Inicial del Curso</CardTitle>
              <CardDescription>
                Ajusta solo el saldo general de caja/banco. No se registra como ingreso operacional.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="opening-amount">Monto</Label>
                <Input id="opening-amount" type="number" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-date">Fecha efectiva</Label>
                <Input id="opening-date" type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="opening-notes">Notas</Label>
                <Textarea id="opening-notes" value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} placeholder="Ej: saldo existente al iniciar uso de la app" />
              </div>
              <div className="md:col-span-3">
                <Button onClick={createOpeningBalance} disabled={savingOpening}>
                  {savingOpening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Registrar saldo inicial
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saldo Inicial Acumulado</CardTitle>
              <CardDescription>Total registrado: ${openingBalanceTotal.toLocaleString("es-CL")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openingBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No hay saldo inicial registrado</TableCell>
                    </TableRow>
                  ) : (
                    openingBalances.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.folio}</TableCell>
                        <TableCell>{row.effective_date}</TableCell>
                        <TableCell>${Number(row.amount).toLocaleString("es-CL")}</TableCell>
                        <TableCell>{row.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registrar Pago Histórico Manual</CardTitle>
              <CardDescription>Trazabilidad por alumno y por mes. Usa folio normal de la app.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Alumno</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione alumno" /></SelectTrigger>
                  <SelectContent>
                    {sortedStudents.map((student) => (
                      <SelectItem key={student.id} value={String(student.id)}>
                        {student.first_name} {student.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={paymentMonth} onValueChange={setPaymentMonth}>
                  <SelectTrigger><SelectValue placeholder="Seleccione mes" /></SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((month) => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de pago</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Concepto</Label>
                <Input value={paymentConcept} onChange={(e) => setPaymentConcept(e.target.value)} placeholder="Ej: Cuota MARZO" />
              </div>
              <div className="md:col-span-2">
                <Button onClick={handleCreateHistoricalPayment} disabled={savingPayment}>
                  {savingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Registrar pago histórico
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Carga Masiva por Planilla</CardTitle>
              <CardDescription>Formato: `student_rut`, `student_name`, `month_period`, `amount`, `payment_date`, `concept`.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Descargar plantilla
              </Button>
              <Label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Importar planilla
                </span>
                <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
              </Label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits">
          <Card>
            <CardHeader>
              <CardTitle>Registrar Saldo a Favor / Crédito Previo</CardTitle>
              <CardDescription>Para saldos previos del alumno antes de ingresar a la app.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Alumno</Label>
                <Select value={creditStudentId} onValueChange={setCreditStudentId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione alumno" /></SelectTrigger>
                  <SelectContent>
                    {sortedStudents.map((student) => (
                      <SelectItem key={student.id} value={String(student.id)}>
                        {student.first_name} {student.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descripción</Label>
                <Textarea value={creditDescription} onChange={(e) => setCreditDescription(e.target.value)} placeholder="Ej: saldo a favor previo, crédito arrastrado, etc." />
              </div>
              <div className="md:col-span-2">
                <Button onClick={handleCreatePreviousCredit} disabled={savingCredit}>
                  {savingCredit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Registrar saldo a favor
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
