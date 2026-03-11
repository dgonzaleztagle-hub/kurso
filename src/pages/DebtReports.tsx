import { useCallback, useEffect, useState } from "react";
import jsPDF from "jspdf";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useTenant } from "@/contexts/TenantContext";
import { parseDateFromDB } from "@/lib/dateUtils";
import { getPdfBranding, loadImageElement } from "@/lib/pdfBranding";
import { calculateMonthlyDebtItems, getAppliedCreditForActivity, getNetPaymentAmount, sameId } from "@/lib/creditAccounting";
import { StudentCombobox } from "@/components/StudentCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Student {
  id: number | string;
  name: string;
  enrollment_date: string;
}

interface Activity {
  id: number;
  name: string;
  amount: number;
  activity_date: string | null;
}

interface MonthlyDebt {
  student_id: number | string;
  student_name: string;
  total_owed: number;
  months_owed: string[];
}

interface ActivityDebt {
  student_id: number | string;
  student_name: string;
  activity_id: number;
  activity_name: string;
  amount_owed: number;
}

interface StudentDebtCertificate {
  studentId: number | string;
  studentName: string;
  monthly: number;
  months: string[];
  activities: Array<{ id: number; name: string; amount: number }>;
}

type StudentRow = Pick<Tables<"students">, "id" | "first_name" | "last_name" | "enrollment_date">;
type ActivityRow = Pick<Tables<"activities">, "id" | "name" | "amount" | "activity_date">;
type PaymentRow = Pick<Tables<"payments">, "student_id" | "concept" | "amount" | "activity_id" | "redirected_amount" | "month_period">;
type MonthlyApplicationRow = Pick<Tables<"credit_applications">, "student_id" | "amount" | "reversed_amount" | "target_type" | "target_month">;
type ActivityApplicationRow = Pick<Tables<"credit_applications">, "student_id" | "amount" | "reversed_amount" | "target_type" | "target_activity_id">;
type ExclusionRow = Pick<Tables<"activity_exclusions">, "student_id" | "activity_id">;

export default function DebtReports() {
  const { currentTenant } = useTenant();
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<"monthly" | "activities" | "both">("monthly");
  const [scope, setScope] = useState<"general" | "individual">("general");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("all");
  const [monthlyDetailType, setMonthlyDetailType] = useState<"summary" | "detailed">("summary");
  const [monthlyPeriod, setMonthlyPeriod] = useState<"current" | "year">("current");
  const [previewMonthlyDebts, setPreviewMonthlyDebts] = useState<MonthlyDebt[]>([]);
  const [previewActivityDebts, setPreviewActivityDebts] = useState<ActivityDebt[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const monthlyFee = Number(currentTenant?.settings?.monthly_fee) > 0
    ? Number(currentTenant?.settings?.monthly_fee)
    : 3000;

  useEffect(() => {
    setShowPreview(false);
    setPreviewMonthlyDebts([]);
    setPreviewActivityDebts([]);
  }, [reportType, scope, selectedStudent, selectedActivity, monthlyDetailType, monthlyPeriod]);

  const loadData = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const [studentsResult, activitiesResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, last_name, enrollment_date")
          .eq("tenant_id", currentTenant.id)
          .order("last_name"),
        supabase
          .from("activities")
          .select("id, name, amount, activity_date")
          .eq("tenant_id", currentTenant.id)
          .order("name"),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (activitiesResult.error) throw activitiesResult.error;

      setStudents(
        (((studentsResult.data as StudentRow[] | null) || []).map((student) => ({
          id: student.id,
          enrollment_date: student.enrollment_date,
          name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin Nombre",
        }))),
      );
      setActivities((activitiesResult.data as ActivityRow[] | null) || []);
    } catch (error: unknown) {
      console.error("Error loading debt report data:", error);
      toast.error("Error al cargar datos");
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    if (currentTenant?.id) {
      void loadData();
    }
  }, [currentTenant?.id, loadData]);

  const getStudentsToProcess = () =>
    scope === "individual" && selectedStudent
      ? students.filter((student) => String(student.id) === selectedStudent)
      : students;

  const getActivitiesToProcess = () =>
    selectedActivity === "all"
      ? activities
      : activities.filter((activity) => String(activity.id) === selectedActivity);

  const calculateMonthlyDebts = async (): Promise<MonthlyDebt[]> => {
    const studentsToProcess = getStudentsToProcess();
    const studentIds = studentsToProcess.map((student) => student.id);

    if (studentIds.length === 0) return [];

    const [paymentsResult, applicationsResult] = await Promise.all([
      supabase
        .from("payments")
        .select("student_id, concept, amount, activity_id, redirected_amount, month_period")
        .eq("tenant_id", currentTenant?.id)
        .in("student_id", studentIds),
      supabase
        .from("credit_applications")
        .select("student_id, amount, reversed_amount, target_type, target_month")
        .eq("tenant_id", currentTenant?.id)
        .in("student_id", studentIds),
    ]);

    if (paymentsResult.error) throw paymentsResult.error;
    if (applicationsResult.error) throw applicationsResult.error;

    const payments = (paymentsResult.data as PaymentRow[] | null) || [];
    const applications = (applicationsResult.data as MonthlyApplicationRow[] | null) || [];

    return studentsToProcess.flatMap((student) => {
      const monthItems = calculateMonthlyDebtItems({
        enrollmentDate: student.enrollment_date,
        monthlyFee,
        payments: payments.filter((payment) => sameId(payment.student_id, student.id)),
        applications: applications.filter((application) => sameId(application.student_id, student.id)),
        period: monthlyPeriod,
      });

      const totalOwed = monthItems.reduce((sum, item) => sum + item.due, 0);
      if (totalOwed <= 0) {
        return [];
      }

      return [{
        student_id: student.id,
        student_name: student.name,
        total_owed: totalOwed,
        months_owed: monthItems.filter((item) => item.due > 0).map((item) => item.month),
      }];
    });
  };

  const calculateActivityDebts = async (): Promise<ActivityDebt[]> => {
    const studentsToProcess = getStudentsToProcess();
    const activitiesToProcess = getActivitiesToProcess();
    const studentIds = studentsToProcess.map((student) => student.id);

    if (studentIds.length === 0 || activitiesToProcess.length === 0) return [];

    const [paymentsResult, exclusionsResult, applicationsResult] = await Promise.all([
      supabase
        .from("payments")
        .select("student_id, concept, amount, activity_id, redirected_amount")
        .eq("tenant_id", currentTenant?.id)
        .in("student_id", studentIds),
      supabase
        .from("activity_exclusions")
        .select("student_id, activity_id")
        .eq("tenant_id", currentTenant?.id)
        .in("student_id", studentIds),
      supabase
        .from("credit_applications")
        .select("student_id, amount, reversed_amount, target_type, target_activity_id")
        .eq("tenant_id", currentTenant?.id)
        .eq("target_type", "activity")
        .in("student_id", studentIds),
    ]);

    if (paymentsResult.error) throw paymentsResult.error;
    if (exclusionsResult.error) throw exclusionsResult.error;
    if (applicationsResult.error) throw applicationsResult.error;

    const payments = (paymentsResult.data as PaymentRow[] | null) || [];
    const exclusions = (exclusionsResult.data as ExclusionRow[] | null) || [];
    const applications = (applicationsResult.data as ActivityApplicationRow[] | null) || [];
    const exclusionMap = new Set(exclusions.map((item) => `${item.student_id}-${item.activity_id}`));

    return studentsToProcess.flatMap((student) =>
      activitiesToProcess.flatMap((activity) => {
        if (exclusionMap.has(`${student.id}-${activity.id}`)) {
          return [];
        }

        const wasNotEnrolled = activity.activity_date
          && parseDateFromDB(student.enrollment_date) > parseDateFromDB(activity.activity_date);

        if (wasNotEnrolled) {
          return [];
        }

        if (activity.activity_date) {
          const activityDate = parseDateFromDB(activity.activity_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (activityDate > today) {
            return [];
          }
        }

        const relatedPayments = payments.filter((payment) =>
          sameId(payment.student_id, student.id)
          && (
            sameId(payment.activity_id, activity.id)
            || String(payment.concept || "").toUpperCase().includes(activity.name.toUpperCase())
          ),
        );

        const totalPaid = relatedPayments.reduce((sum, payment) => sum + getNetPaymentAmount(payment), 0);
        const appliedCredit = getAppliedCreditForActivity(
          applications.filter((application) => sameId(application.student_id, student.id)),
          activity.id,
        );
        const amountOwed = Math.max(0, Number(activity.amount || 0) - totalPaid - appliedCredit);

        if (amountOwed <= 0) {
          return [];
        }

        return [{
          student_id: student.id,
          student_name: student.name,
          activity_id: activity.id,
          activity_name: activity.name,
          amount_owed: amountOwed,
        }];
      }),
    );
  };

  const calculateReportData = async () => {
    const [monthlyDebts, activityDebts] = await Promise.all([
      reportType === "activities" ? Promise.resolve([] as MonthlyDebt[]) : calculateMonthlyDebts(),
      reportType === "monthly" ? Promise.resolve([] as ActivityDebt[]) : calculateActivityDebts(),
    ]);

    return { monthlyDebts, activityDebts };
  };

  const buildStudentsWithDebt = (monthlyDebts: MonthlyDebt[], activityDebts: ActivityDebt[]) => {
    const studentsWithDebt = new Map<string, StudentDebtCertificate>();

    monthlyDebts.forEach((debt) => {
      studentsWithDebt.set(String(debt.student_id), {
        studentId: debt.student_id,
        studentName: debt.student_name,
        monthly: debt.total_owed,
        months: debt.months_owed,
        activities: [],
      });
    });

    activityDebts.forEach((debt) => {
      const existing = studentsWithDebt.get(String(debt.student_id)) || {
        studentId: debt.student_id,
        studentName: debt.student_name,
        monthly: 0,
        months: [],
        activities: [],
      };

      existing.activities.push({
        id: debt.activity_id,
        name: debt.activity_name,
        amount: debt.amount_owed,
      });

      studentsWithDebt.set(String(debt.student_id), existing);
    });

    return studentsWithDebt;
  };

  const getReportSnapshot = async () => {
    if (showPreview) {
      return {
        monthlyDebts: previewMonthlyDebts,
        activityDebts: previewActivityDebts,
      };
    }

    return calculateReportData();
  };

  const handleConsultDebts = async () => {
    if (!currentTenant?.id) {
      toast.error("Error: No se ha identificado el curso actual");
      return;
    }

    try {
      setLoading(true);
      const { monthlyDebts, activityDebts } = await calculateReportData();
      setPreviewMonthlyDebts(monthlyDebts);
      setPreviewActivityDebts(activityDebts);
      setShowPreview(true);
      toast.success("Deudas consultadas exitosamente");
    } catch (error) {
      console.error("Error consulting debts:", error);
      toast.error("Error al consultar deudas");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    try {
      setLoading(true);
      const { monthlyDebts, activityDebts } = await getReportSnapshot();
      const doc = new jsPDF();
      const pdfBranding = getPdfBranding(currentTenant);
      const logoImg = await loadImageElement(pdfBranding.logoUrl);

      doc.setFillColor(240, 245, 250);
      doc.rect(0, 0, 210, 36, "F");

      if (logoImg) {
        doc.addImage(logoImg, "PNG", 15, 8, 22, 22);
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("INFORME DE DEUDAS", 105, 18, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(pdfBranding.reportSubtitle, 105, 24, { align: "center" });
      doc.text(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, 105, 28, { align: "center" });

      let yPos = 42;

      if (monthlyDebts.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("CUOTAS MENSUALES ADEUDADAS", 15, yPos);
        yPos += 8;

        monthlyDebts.forEach((debt, index) => {
          if (yPos > 275) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(51, 65, 85);
          doc.text(`${index + 1}. ${debt.student_name}`, 17, yPos);
          yPos += 4;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          if (monthlyDetailType === "detailed") {
            doc.text(`Meses: ${debt.months_owed.join(", ")}`, 22, yPos);
            yPos += 4;
          }

          doc.setFont("helvetica", "bold");
          doc.setTextColor(220, 38, 38);
          doc.text(`Monto adeudado: $${debt.total_owed.toLocaleString("es-CL")}`, 22, yPos);
          yPos += 7;
        });
      }

      if (activityDebts.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("ACTIVIDADES ADEUDADAS", 15, yPos);
        yPos += 8;

        const groupedByActivity = activityDebts.reduce<Record<string, ActivityDebt[]>>((acc, debt) => {
          acc[debt.activity_name] = [...(acc[debt.activity_name] || []), debt];
          return acc;
        }, {});

        Object.entries(groupedByActivity).forEach(([activityName, debts]) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 64, 175);
          doc.text(activityName, 17, yPos);
          yPos += 5;

          debts.forEach((debt) => {
            if (yPos > 275) {
              doc.addPage();
              yPos = 20;
            }

            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            doc.text(`• ${debt.student_name}`, 22, yPos);
            doc.setTextColor(220, 38, 38);
            doc.text(`$${debt.amount_owed.toLocaleString("es-CL")}`, 190, yPos, { align: "right" });
            yPos += 4;
          });

          yPos += 3;
        });
      }

      const pageHeight = doc.internal.pageSize.getHeight();
      const signatureYPos = pageHeight - 45;
      doc.setDrawColor(59, 130, 246);
      doc.line(15, signatureYPos, 195, signatureYPos);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(pdfBranding.signatureCourseLine, 190, signatureYPos + 10, { align: "right" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(pdfBranding.signatureInstitutionLine, 190, signatureYPos + 16, { align: "right" });

      const suffix = reportType === "activities"
        ? "Actividades_Adeudadas"
        : reportType === "monthly"
          ? "Cuotas_Adeudadas"
          : "Deudas_General";

      doc.save(`Informe_${suffix}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Informe PDF generado exitosamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el informe");
    } finally {
      setLoading(false);
    }
  };

  const generateDebtCertificatesPDF = async (studentsWithDebt: Map<string, StudentDebtCertificate>) => {
    const doc = new jsPDF();
    const currentDate = new Date();
    const pdfBranding = getPdfBranding(currentTenant);
    const logoImg = await loadImageElement(pdfBranding.logoUrl);
    let isFirstPage = true;

    for (const [, debts] of studentsWithDebt.entries()) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = 18;

      if (logoImg) {
        doc.addImage(logoImg, "PNG", margin, yPos - 3, 25, 25);
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("CERTIFICADO DE DEUDA", pageWidth / 2, yPos + 8, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha de emision: ${currentDate.toLocaleDateString("es-CL")}`, pageWidth - margin, yPos + 8, { align: "right" });

      yPos += 32;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("APODERADO DE:", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(debts.studentName, margin + 40, yPos);

      yPos += 14;
      doc.setFont("helvetica", "bold");
      doc.text("DETALLE DE DEUDAS PENDIENTES:", margin, yPos);
      yPos += 10;

      if (debts.monthly > 0) {
        doc.setFont("helvetica", "normal");
        doc.text("Cuotas Mensuales", margin + 5, yPos);
        yPos += 7;
        if (debts.months.length > 0) {
          const monthText = doc.splitTextToSize(`Meses: ${debts.months.join(", ")}`, pageWidth - margin * 2 - 10);
          doc.text(monthText, margin + 10, yPos);
          yPos += monthText.length * 5;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`Monto: $${debts.monthly.toLocaleString("es-CL")}`, margin + 10, yPos);
        yPos += 10;
      }

      if (debts.activities.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.text("Actividades", margin + 5, yPos);
        yPos += 7;
        debts.activities.forEach((activity) => {
          doc.text(`• ${activity.name}`, margin + 10, yPos);
          doc.setFont("helvetica", "bold");
          doc.text(`$${activity.amount.toLocaleString("es-CL")}`, pageWidth - margin, yPos, { align: "right" });
          doc.setFont("helvetica", "normal");
          yPos += 6;
        });
        yPos += 4;
      }

      const totalDebt = debts.monthly + debts.activities.reduce((sum, activity) => sum + activity.amount, 0);
      doc.setDrawColor(200, 0, 0);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0);
      doc.text("TOTAL ADEUDADO:", margin + 5, yPos);
      doc.text(`$${totalDebt.toLocaleString("es-CL")}`, pageWidth - margin - 5, yPos, { align: "right" });
      doc.setTextColor(0, 0, 0);

      yPos += 15;
      const validityText = doc.splitTextToSize(
        `Este certificado refleja el estado de deuda al ${currentDate.toLocaleDateString("es-CL")}.`,
        pageWidth - margin * 2,
      );
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(validityText, margin, yPos);

      const signatureY = pageHeight - 70;
      doc.setLineWidth(0.3);
      doc.line(pageWidth / 2 - 35, signatureY, pageWidth / 2 + 35, signatureY);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(pdfBranding.signatureCourseLine, pageWidth / 2, signatureY + 5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(pdfBranding.signatureInstitutionLine, pageWidth / 2, signatureY + 10, { align: "center" });

      const parentSignY = pageHeight - 35;
      doc.line(margin + 10, parentSignY, pageWidth / 2 - 10, parentSignY);
      doc.line(pageWidth / 2 + 10, parentSignY, pageWidth - margin - 10, parentSignY);
      doc.text("Firma del Apoderado", (margin + pageWidth / 2) / 2, parentSignY + 5, { align: "center" });
      doc.text("Fecha de Recepcion", (pageWidth / 2 + pageWidth - margin) / 2, parentSignY + 5, { align: "center" });
    }

    doc.save(`Certificados_Deuda_${currentDate.toLocaleDateString("es-CL").replace(/\//g, "-")}.pdf`);
  };

  const handleGenerateDebtCertificates = async () => {
    try {
      setLoading(true);
      const { monthlyDebts, activityDebts } = await getReportSnapshot();
      const studentsWithDebt = buildStudentsWithDebt(monthlyDebts, activityDebts);

      if (studentsWithDebt.size === 0) {
        toast.info("No hay estudiantes con deudas pendientes");
        return;
      }

      await generateDebtCertificatesPDF(studentsWithDebt);
      toast.success(`Certificados generados para ${studentsWithDebt.size} estudiante(s)`);
    } catch (error) {
      console.error("Error generating certificates:", error);
      toast.error("Error al generar certificados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Reportes de Deudas</h1>
        <p className="text-muted-foreground">Genere informes de deudas para compartir</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurar Informe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Tipo de Deuda</Label>
              <Select value={reportType} onValueChange={(value: "monthly" | "activities" | "both") => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Cuotas Mensuales</SelectItem>
                  <SelectItem value="activities">Actividades</SelectItem>
                  <SelectItem value="both">Ambas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Alcance</Label>
              <Select value={scope} onValueChange={(value: "general" | "individual") => setScope(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General (Todos)</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "individual" && (
              <div className="space-y-2">
                <Label>Seleccionar Estudiante</Label>
                <StudentCombobox
                  students={students}
                  value={selectedStudent}
                  onValueChange={setSelectedStudent}
                  placeholder="Buscar estudiante..."
                />
              </div>
            )}

            {(reportType === "activities" || reportType === "both") && (
              <div className="space-y-2">
                <Label>Actividad</Label>
                <Select value={selectedActivity} onValueChange={setSelectedActivity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las actividades</SelectItem>
                    {activities.map((activity) => (
                      <SelectItem key={activity.id} value={String(activity.id)}>
                        {activity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(reportType === "monthly" || reportType === "both") && (
              <>
                <div className="space-y-2">
                  <Label>Detalle de Cuotas</Label>
                  <Select value={monthlyDetailType} onValueChange={(value: "summary" | "detailed") => setMonthlyDetailType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Resumen (Total adeudado)</SelectItem>
                      <SelectItem value="detailed">Detallado (Por meses)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Período de Cuotas</Label>
                  <Select value={monthlyPeriod} onValueChange={(value: "current" | "year") => setMonthlyPeriod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Hasta mes en curso</SelectItem>
                      <SelectItem value="year">Todo el año</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleConsultDebts}
              disabled={loading || (scope === "individual" && !selectedStudent)}
              className="w-full sm:flex-1"
            >
              <FileText className="mr-2 h-4 w-4" />
              {loading ? "Consultando..." : "Consultar Deudas"}
            </Button>
            <Button
              onClick={handleGenerateDebtCertificates}
              disabled={loading || (scope === "individual" && !selectedStudent)}
              variant="secondary"
              className="w-full sm:flex-1"
            >
              <FileText className="mr-2 h-4 w-4" />
              {loading ? "Generando..." : "Certificados de Deuda"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
              <div>
                <CardTitle className="text-base md:text-xl">Vista Previa de Deudas</CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Revise las deudas antes de generar el PDF</p>
              </div>
              {(previewMonthlyDebts.length > 0 || previewActivityDebts.length > 0) && (
                <Button onClick={generatePDF} disabled={loading} size="sm" className="h-8 md:h-10 text-xs md:text-sm">
                  <FileText className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                  {loading ? "Generando..." : "Generar PDF"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {previewMonthlyDebts.length === 0 && previewActivityDebts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay deudas pendientes segun los criterios seleccionados
              </div>
            ) : (
              <div className="space-y-6">
                {previewMonthlyDebts.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Cuotas Mensuales Adeudadas</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estudiante</TableHead>
                          {monthlyDetailType === "detailed" && <TableHead>Meses</TableHead>}
                          <TableHead className="text-right">Monto Adeudado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewMonthlyDebts.map((debt, index) => (
                          <TableRow key={`${debt.student_name}-${index}`}>
                            <TableCell className="font-medium">{debt.student_name}</TableCell>
                            {monthlyDetailType === "detailed" && <TableCell>{debt.months_owed.join(", ")}</TableCell>}
                            <TableCell className="text-right font-semibold text-red-600">
                              ${debt.total_owed.toLocaleString("es-CL")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {previewActivityDebts.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Actividades Adeudadas</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estudiante</TableHead>
                          <TableHead>Actividad</TableHead>
                          <TableHead className="text-right">Monto Adeudado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewActivityDebts.map((debt, index) => (
                          <TableRow key={`${debt.student_name}-${debt.activity_id}-${index}`}>
                            <TableCell className="font-medium">{debt.student_name}</TableCell>
                            <TableCell>{debt.activity_name}</TableCell>
                            <TableCell className="text-right font-semibold text-red-600">
                              ${debt.amount_owed.toLocaleString("es-CL")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Instrucciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Configure el tipo de deuda que desea informar (cuotas, actividades o ambas)</p>
          <p>• Seleccione si desea un informe general o de un estudiante específico</p>
          <p>• Para actividades, puede elegir todas o una actividad puntual</p>
          <p>• Consulte las deudas para ver una vista previa antes de generar el PDF</p>
          <p>• El informe PDF incluirá solo estudiantes con deudas pendientes</p>
          <p>• Los certificados respetan los mismos filtros aplicados en pantalla</p>
        </CardContent>
      </Card>
    </div>
  );
}
