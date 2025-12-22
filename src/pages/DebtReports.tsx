import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import jsPDF from "jspdf";
import logoImage from "@/assets/logo-colegio.png";
import firmaImage from "@/assets/firma-directiva.png";
import { StudentCombobox } from "@/components/StudentCombobox";
import { parseDateFromDB } from "@/lib/dateUtils";

interface Student {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  enrollment_date: string;
}

interface Activity {
  id: number;
  name: string;
  amount: number;
  activity_date: string | null;
}

interface MonthlyDebt {
  student_name: string;
  total_owed: number;
  months_owed: string[];
}

interface ActivityDebt {
  student_name: string;
  activity_name: string;
  amount_owed: number;
}

export default function DebtReports() {
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [reportType, setReportType] = useState<"monthly" | "activities" | "both">("monthly");
  const [scope, setScope] = useState<"general" | "individual">("general");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [monthlyDetailType, setMonthlyDetailType] = useState<"summary" | "detailed">("summary");
  const [monthlyPeriod, setMonthlyPeriod] = useState<"current" | "year">("current");

  // Preview data
  const [previewMonthlyDebts, setPreviewMonthlyDebts] = useState<MonthlyDebt[]>([]);
  const [previewActivityDebts, setPreviewActivityDebts] = useState<ActivityDebt[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsResult, activitiesResult] = await Promise.all([
        supabase.from("students").select("id, first_name, last_name, enrollment_date").order("last_name"),
        supabase.from("activities").select("*")
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (activitiesResult.error) throw activitiesResult.error;

      const mappedStudents = (studentsResult.data || []).map(s => ({
        ...s,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Sin Nombre'
      }));

      setStudents(mappedStudents);
      setActivities(activitiesResult.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar datos");
    }
  };

  const calculateMonthlyDebts = async (): Promise<MonthlyDebt[]> => {
    const [paymentsResult, studentsDataResult, creditsResult, creditMovementsResult] = await Promise.all([
      supabase
        .from("payments")
        .select("student_id, student_name, concept, amount, month_period"),
      supabase
        .from("students")
        .select("id, first_name, last_name, enrollment_date"),
      supabase
        .from("student_credits")
        .select("student_id, amount"),
      supabase
        .from("credit_movements")
        .select("student_id, amount, type")
        .eq("type", "payment_redirect")
    ]);

    const monthlyFee = 3000;
    const months = ["MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

    // Determine max month based on period filter
    const currentMonth = new Date().getMonth(); // 0-11
    const currentYear = new Date().getFullYear();
    const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const currentMonthName = monthNames[currentMonth];

    let maxMonthIndex = months.length;
    if (monthlyPeriod === "current") {
      maxMonthIndex = months.findIndex(m => m === currentMonthName) + 1;
      if (maxMonthIndex <= 0) maxMonthIndex = months.length;
    }

    const debts: MonthlyDebt[] = [];
    const credits = creditsResult.data || [];

    const studentsToProcess = scope === "individual" && selectedStudent
      ? students.filter(s => s.id.toString() === selectedStudent)
      : students;

    studentsToProcess.forEach(student => {
      // Obtener fecha de matrícula
      const studentData = studentsDataResult.data?.find(s => s.id === student.id);
      if (!studentData) return;

      const enrollmentDate = parseDateFromDB(studentData.enrollment_date);
      const enrollmentMonth = enrollmentDate.getMonth(); // 0-11
      const enrollmentYear = enrollmentDate.getFullYear();

      // Determinar desde qué mes debe pagar este estudiante
      const startMonth = 2; // Marzo = index 2
      let firstPayableMonthIndex = startMonth;

      if (enrollmentYear === currentYear && enrollmentMonth > startMonth) {
        firstPayableMonthIndex = enrollmentMonth;
      }

      // Calcular cuántos meses debe pagar este estudiante específicamente
      const monthsStudentShouldPay = Math.min(maxMonthIndex, months.length) - (firstPayableMonthIndex - startMonth);
      const expectedTotal = monthsStudentShouldPay * monthlyFee;

      // Obtener todos los pagos de cuotas de este estudiante
      const studentPayments = paymentsResult.data?.filter(p =>
        p.student_id === student.id &&
        p.concept?.toUpperCase().includes("CUOTA")
      ) || [];

      // Sum ALL payments for monthly fees (regardless of month_period)
      let totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Add payment redirections (negative credit movements that represent covered monthly fees)
      const studentRedirections = creditMovementsResult.data?.filter(cm =>
        cm.student_id === student.id && cm.amount < 0
      ) || [];
      const redirectionAmount = studentRedirections.reduce((sum, cm) => sum + Math.abs(Number(cm.amount)), 0);
      totalPaid += redirectionAmount;
      let totalOwed = Math.max(0, expectedTotal - totalPaid);

      // Aplicar crédito del estudiante a la deuda
      const studentCredit = credits.find(c => c.student_id === student.id);
      const creditAmount = studentCredit ? Number(studentCredit.amount) : 0;

      // Restar el crédito de la deuda de cuotas mensuales
      const debtAfterCredit = Math.max(0, totalOwed - creditAmount);

      // Solo agregar al reporte si aún debe después de aplicar crédito
      if (debtAfterCredit > 0) {
        // Calculate how many months are completely unpaid
        const monthsOwedCount = Math.ceil(debtAfterCredit / monthlyFee);

        // Get the months this student should pay (from their enrollment month to max month)
        const studentMonths = months.slice(firstPayableMonthIndex - startMonth, Math.min(maxMonthIndex, months.length));

        // Get the last N months from the student's payable months
        const owedMonths = studentMonths.slice(-monthsOwedCount);

        debts.push({
          student_name: student.name,
          total_owed: debtAfterCredit,
          months_owed: owedMonths
        });
      }
    });

    return debts;
  };

  const calculateActivityDebts = async (monthlyCreditsUsed: Map<number, number>): Promise<ActivityDebt[]> => {
    const [paymentsResult, exclusionsResult, creditsResult] = await Promise.all([
      supabase.from("payments").select("student_id, student_name, concept, amount"),
      supabase.from("activity_exclusions").select("student_id, activity_id"),
      supabase.from("student_credits").select("student_id, amount")
    ]);

    const payments = paymentsResult.data || [];
    const exclusions = exclusionsResult.data || [];
    const credits = creditsResult.data || [];
    const debts: ActivityDebt[] = [];

    const exclusionMap = new Set(
      exclusions.map(e => `${e.student_id}-${e.activity_id}`)
    );

    const studentsToProcess = scope === "individual" && selectedStudent
      ? students.filter(s => s.id.toString() === selectedStudent)
      : students;

    studentsToProcess.forEach(student => {
      // Obtener crédito disponible después de aplicar a cuotas mensuales
      const studentCredit = credits.find(c => c.student_id === student.id);
      const totalCredit = studentCredit ? Number(studentCredit.amount) : 0;
      const creditUsedOnMonthly = monthlyCreditsUsed.get(student.id) || 0;
      let remainingCredit = Math.max(0, totalCredit - creditUsedOnMonthly);

      activities.forEach(activity => {
        const key = `${student.id}-${activity.id}`;
        const isExcluded = exclusionMap.has(key);

        // Check if student was enrolled at activity date
        const wasNotEnrolled = activity.activity_date &&
          student.enrollment_date &&
          parseDateFromDB(student.enrollment_date) > parseDateFromDB(activity.activity_date);

        if (!isExcluded && !wasNotEnrolled) {
          const activityPayments = payments.filter(p =>
            p.student_id === student.id &&
            p.concept?.toUpperCase().includes(activity.name.toUpperCase())
          );

          const totalPaid = activityPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          let amountOwed = activity.amount - totalPaid;

          // Aplicar crédito restante a esta actividad si hay deuda
          if (amountOwed > 0 && remainingCredit > 0) {
            const creditToApply = Math.min(amountOwed, remainingCredit);
            amountOwed -= creditToApply;
            remainingCredit -= creditToApply;
          }

          // Solo agregar si aún debe después de aplicar crédito
          if (amountOwed > 0) {
            debts.push({
              student_name: student.name,
              activity_name: activity.name,
              amount_owed: amountOwed
            });
          }
        }
      });
    });

    return debts;
  };

  const handleConsultDebts = async () => {
    try {
      setLoading(true);

      // Mapa para rastrear cuánto crédito se usó en cuotas mensuales por estudiante
      const monthlyCreditsUsed = new Map<number, number>();

      if (reportType === "monthly" || reportType === "both") {
        // Calcular deudas mensuales y rastrear créditos usados
        const [paymentsResult, studentsDataResult, creditsResult, creditMovementsResult] = await Promise.all([
          supabase.from("payments").select("student_id, student_name, concept, amount, month_period"),
          supabase.from("students").select("id, first_name, last_name, enrollment_date"),
          supabase.from("student_credits").select("student_id, amount"),
          supabase.from("credit_movements").select("student_id, amount, type").eq("type", "payment_redirect")
        ]);

        const monthlyFee = 3000;
        const months = ["MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const currentMonthName = monthNames[currentMonth];

        let maxMonthIndex = months.length;
        if (monthlyPeriod === "current") {
          maxMonthIndex = months.findIndex(m => m === currentMonthName) + 1;
          if (maxMonthIndex <= 0) maxMonthIndex = months.length;
        }

        const credits = creditsResult.data || [];
        const studentsToProcess = scope === "individual" && selectedStudent
          ? students.filter(s => s.id.toString() === selectedStudent)
          : students;

        studentsToProcess.forEach(student => {
          const studentData = studentsDataResult.data?.find(s => s.id === student.id);
          if (!studentData) return;

          const enrollmentDate = parseDateFromDB(studentData.enrollment_date);
          const enrollmentMonth = enrollmentDate.getMonth();
          const enrollmentYear = enrollmentDate.getFullYear();

          const startMonth = 2;
          let firstPayableMonthIndex = startMonth;

          if (enrollmentYear === currentYear && enrollmentMonth > startMonth) {
            firstPayableMonthIndex = enrollmentMonth;
          }

          const monthsStudentShouldPay = Math.min(maxMonthIndex, months.length) - (firstPayableMonthIndex - startMonth);
          const expectedTotal = monthsStudentShouldPay * monthlyFee;

          const studentPayments = paymentsResult.data?.filter(p =>
            p.student_id === student.id &&
            p.concept?.toUpperCase().includes("CUOTA")
          ) || [];

          let totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);

          // Add payment redirections
          const studentRedirections = creditMovementsResult.data?.filter(cm =>
            cm.student_id === student.id && cm.amount < 0
          ) || [];
          const redirectionAmount = studentRedirections.reduce((sum, cm) => sum + Math.abs(Number(cm.amount)), 0);
          totalPaid += redirectionAmount;
          const totalOwed = Math.max(0, expectedTotal - totalPaid);

          // Obtener y aplicar crédito
          const studentCredit = credits.find(c => c.student_id === student.id);
          const creditAmount = studentCredit ? Number(studentCredit.amount) : 0;

          const creditUsedHere = Math.min(totalOwed, creditAmount);
          monthlyCreditsUsed.set(student.id, creditUsedHere);
        });

        const monthlyDebts = await calculateMonthlyDebts();
        setPreviewMonthlyDebts(monthlyDebts);
      } else {
        setPreviewMonthlyDebts([]);
      }

      if (reportType === "activities" || reportType === "both") {
        const activityDebts = await calculateActivityDebts(monthlyCreditsUsed);
        setPreviewActivityDebts(activityDebts);
      } else {
        setPreviewActivityDebts([]);
      }

      setShowPreview(true);
      toast.success("Deudas consultadas exitosamente");
    } catch (error) {
      console.error("Error consulting debts:", error);
      toast.error("Error al consultar deudas");
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyCreditsUsed = async (): Promise<Map<number, number>> => {
    const [paymentsResult, studentsDataResult, creditsResult, creditMovementsResult] = await Promise.all([
      supabase.from("payments").select("student_id, concept, amount"),
      supabase.from("students").select("id, first_name, last_name, enrollment_date"),
      supabase.from("student_credits").select("student_id, amount"),
      supabase.from("credit_movements").select("student_id, amount, type").eq("type", "payment_redirect")
    ]);

    const monthlyFee = 3000;
    const months = ["MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const currentMonthName = monthNames[currentMonth];

    let maxMonthIndex = months.length;
    if (monthlyPeriod === "current") {
      maxMonthIndex = months.findIndex(m => m === currentMonthName) + 1;
      if (maxMonthIndex <= 0) maxMonthIndex = months.length;
    }

    const monthlyCreditsUsed = new Map<number, number>();
    const credits = creditsResult.data || [];

    const studentsToProcess = scope === "individual" && selectedStudent
      ? students.filter(s => s.id.toString() === selectedStudent)
      : students;

    studentsToProcess.forEach(student => {
      const studentData = studentsDataResult.data?.find(s => s.id === student.id);
      if (!studentData) return;

      const enrollmentDate = parseDateFromDB(studentData.enrollment_date);
      const enrollmentMonth = enrollmentDate.getMonth();
      const enrollmentYear = enrollmentDate.getFullYear();

      const startMonth = 2;
      let firstPayableMonthIndex = startMonth;

      if (enrollmentYear === currentYear && enrollmentMonth > startMonth) {
        firstPayableMonthIndex = enrollmentMonth;
      }

      const monthsStudentShouldPay = Math.min(maxMonthIndex, months.length) - (firstPayableMonthIndex - startMonth);
      const expectedTotal = monthsStudentShouldPay * monthlyFee;

      const studentPayments = paymentsResult.data?.filter(p =>
        p.student_id === student.id &&
        p.concept?.toUpperCase().includes("CUOTA")
      ) || [];

      let totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Add payment redirections
      const studentRedirections = creditMovementsResult.data?.filter(cm =>
        cm.student_id === student.id && cm.amount < 0
      ) || [];
      const redirectionAmount = studentRedirections.reduce((sum, cm) => sum + Math.abs(Number(cm.amount)), 0);
      totalPaid += redirectionAmount;
      const totalOwed = Math.max(0, expectedTotal - totalPaid);

      const studentCredit = credits.find(c => c.student_id === student.id);
      const creditAmount = studentCredit ? Number(studentCredit.amount) : 0;

      const creditUsedHere = Math.min(totalOwed, creditAmount);
      monthlyCreditsUsed.set(student.id, creditUsedHere);
    });

    return monthlyCreditsUsed;
  };

  const generatePDF = async () => {
    try {
      setLoading(true);
      const doc = new jsPDF();

      // Load images
      const [logoImg, firmaImg] = await Promise.all([
        new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.src = logoImage;
          img.onload = () => resolve(img);
        }),
        new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.src = firmaImage;
          img.onload = () => resolve(img);
        })
      ]);

      // Header background with subtle color
      doc.setFillColor(240, 245, 250);
      doc.rect(0, 0, 210, 36, 'F');

      // Add header logo
      doc.addImage(logoImg, 'PNG', 15, 12, 22, 22);

      // Title section
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138); // Dark blue
      doc.text("INFORME DE DEUDAS", 105, 18, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // Slate gray
      doc.text("Pre Kinder B - Colegio Santa Cruz", 105, 24, { align: "center" });
      doc.text(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, 105, 28, { align: "center" });

      // Horizontal line separator with color
      doc.setDrawColor(59, 130, 246); // Blue
      doc.setLineWidth(0.5);
      doc.line(15, 34, 195, 34);

      let yPos = 42;

      // Combined report (both monthly and activities)
      if (reportType === "both") {
        const monthlyCreditsUsed = await calculateMonthlyCreditsUsed();
        const [monthlyDebts, activityDebts] = await Promise.all([
          calculateMonthlyDebts(),
          calculateActivityDebts(monthlyCreditsUsed)
        ]);

        // Combine debts by student with detailed info
        const combinedDebts = new Map<string, {
          monthlyOwed: number;
          monthsOwed: string[];
          activityOwed: number;
          activities: { name: string; amount: number }[];
          total: number;
        }>();

        monthlyDebts.forEach(debt => {
          combinedDebts.set(debt.student_name, {
            monthlyOwed: debt.total_owed,
            monthsOwed: debt.months_owed,
            activityOwed: 0,
            activities: [],
            total: debt.total_owed
          });
        });

        activityDebts.forEach(debt => {
          const existing = combinedDebts.get(debt.student_name);
          if (existing) {
            existing.activityOwed += debt.amount_owed;
            existing.activities.push({ name: debt.activity_name, amount: debt.amount_owed });
            existing.total += debt.amount_owed;
          } else {
            combinedDebts.set(debt.student_name, {
              monthlyOwed: 0,
              monthsOwed: [],
              activityOwed: debt.amount_owed,
              activities: [{ name: debt.activity_name, amount: debt.amount_owed }],
              total: debt.amount_owed
            });
          }
        });

        if (combinedDebts.size > 0) {
          // Section title with background
          doc.setFillColor(237, 242, 247);
          doc.rect(15, yPos - 3, 180, 7, 'F');

          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 58, 138);
          doc.text("DEUDAS TOTALES POR ALUMNO", 17, yPos + 1);
          yPos += 8;

          doc.setFontSize(9);

          let index = 0;
          combinedDebts.forEach((debt, studentName) => {
            const detailLines = monthlyDetailType === "detailed"
              ? (debt.monthsOwed.length > 0 ? 1 : 0) + (debt.activities.length > 0 ? 1 : 0) + 1
              : 1;
            const itemHeight = 4 + (detailLines * 3.5) + 3;

            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }

            // Subtle alternating background
            if (index % 2 === 0) {
              doc.setFillColor(249, 250, 251);
              doc.rect(17, yPos - 2, 176, itemHeight + 2, 'F');
            }

            // Student name
            doc.setFont("helvetica", "bold");
            doc.setTextColor(51, 65, 85);
            doc.text(`${index + 1}. ${studentName}`, 18, yPos);
            yPos += 4;

            if (monthlyDetailType === "summary") {
              // Summary mode
              doc.setFont("helvetica", "normal");
              doc.setTextColor(71, 85, 105);
              doc.text(`Cuotas: $${debt.monthlyOwed.toLocaleString("es-CL")} | Actividades: $${debt.activityOwed.toLocaleString("es-CL")}`, 23, yPos);
              yPos += 3.5;
            } else {
              // Detailed mode
              doc.setFont("helvetica", "normal");
              doc.setTextColor(71, 85, 105);

              if (debt.monthsOwed.length > 0) {
                doc.text(`Cuotas (${debt.monthsOwed.join(", ")}): $${debt.monthlyOwed.toLocaleString("es-CL")}`, 23, yPos);
                yPos += 3.5;
              }

              if (debt.activities.length > 0) {
                const activitiesText = debt.activities.map(a => a.name).join(", ");
                doc.text(`Actividades (${activitiesText}): $${debt.activityOwed.toLocaleString("es-CL")}`, 23, yPos);
                yPos += 3.5;
              }
            }

            // Total
            doc.setFont("helvetica", "bold");
            doc.setTextColor(220, 38, 38);
            doc.text(`Total adeudado: $${debt.total.toLocaleString("es-CL")}`, 23, yPos);
            yPos += 6;

            index++;
          });

          yPos += 3;
        }
      }

      // Monthly debts only
      else if (reportType === "monthly") {
        const monthlyDebts = await calculateMonthlyDebts();

        if (monthlyDebts.length > 0) {
          // Section title with background
          doc.setFillColor(237, 242, 247);
          doc.rect(15, yPos - 3, 180, 7, 'F');

          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 58, 138);
          doc.text("CUOTAS MENSUALES ADEUDADAS", 17, yPos + 1);
          yPos += 8;

          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");

          monthlyDebts.forEach((debt, index) => {
            if (yPos > 275) {
              doc.addPage();
              yPos = 20;
            }

            // Subtle alternating background
            if (index % 2 === 0) {
              doc.setFillColor(249, 250, 251);
              doc.rect(17, yPos - 2, 176, monthlyDetailType === "summary" ? 7 : 10, 'F');
            }

            // Student name with number
            doc.setFont("helvetica", "bold");
            doc.setTextColor(51, 65, 85);
            doc.text(`${index + 1}. ${debt.student_name}`, 18, yPos);
            yPos += 4;

            // Debt details
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            if (monthlyDetailType === "summary") {
              doc.setTextColor(220, 38, 38);
              doc.text(`Monto adeudado: $${debt.total_owed.toLocaleString("es-CL")}`, 23, yPos);
              yPos += 5;
            } else {
              doc.setTextColor(71, 85, 105);
              doc.text(`Meses: ${debt.months_owed.join(", ")}`, 23, yPos);
              yPos += 3;
              doc.setFont("helvetica", "bold");
              doc.setTextColor(220, 38, 38);
              doc.text(`Total: $${debt.total_owed.toLocaleString("es-CL")}`, 23, yPos);
              yPos += 5;
              doc.setFont("helvetica", "normal");
            }
          });

          yPos += 3;
        }
      }

      // Activity debts only
      else if (reportType === "activities") {
        const monthlyCreditsUsed = await calculateMonthlyCreditsUsed();
        const activityDebts = await calculateActivityDebts(monthlyCreditsUsed);

        if (activityDebts.length > 0) {
          if (yPos > 255) {
            doc.addPage();
            yPos = 20;
          }

          // Section title with background
          doc.setFillColor(237, 242, 247);
          doc.rect(15, yPos - 3, 180, 7, 'F');

          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 58, 138);
          doc.text("ACTIVIDADES ADEUDADAS", 17, yPos + 1);
          yPos += 8;

          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");

          // Group by activity
          const grouped = activityDebts.reduce((acc, debt) => {
            if (!acc[debt.activity_name]) {
              acc[debt.activity_name] = [];
            }
            acc[debt.activity_name].push(debt);
            return acc;
          }, {} as Record<string, ActivityDebt[]>);

          Object.entries(grouped).forEach(([activityName, debts]) => {
            if (yPos > 275) {
              doc.addPage();
              yPos = 20;
            }

            // Activity name with subtle background
            doc.setFillColor(243, 244, 246);
            doc.rect(17, yPos - 2, 176, 5, 'F');

            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 64, 175);
            doc.text(activityName, 18, yPos);
            yPos += 5;

            // Students owing this activity
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            debts.forEach(debt => {
              if (yPos > 278) {
                doc.addPage();
                yPos = 20;
              }
              doc.setTextColor(71, 85, 105);
              doc.text(`  • ${debt.student_name}: `, 23, yPos, { align: 'left' });
              doc.setTextColor(220, 38, 38);
              doc.text(`$${debt.amount_owed.toLocaleString("es-CL")}`, 85, yPos);
              yPos += 3.5;
            });

            yPos += 2;
          });
        }
      }

      // Add signature at the bottom of last page
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Reserve space for signature (45mm from bottom)
      const signatureSpace = 45;

      // Check if there's enough space for signature on current page
      if (yPos > pageHeight - signatureSpace - 5) {
        // Only add new page if we're already far down the page
        // If content is minimal, keep signature on same page
        if (yPos > 100) {
          doc.addPage();
          yPos = 20;
        }
      }

      // Position signature at bottom
      const signatureYPos = pageHeight - 45;

      // Add bottom separator line with color
      doc.setDrawColor(59, 130, 246); // Blue
      doc.setLineWidth(0.5);
      doc.line(15, signatureYPos, 195, signatureYPos);

      // Add signature image at bottom right
      doc.addImage(firmaImg, 'PNG', pageWidth - 62, signatureYPos + 5, 47, 35);

      // Save PDF with appropriate name
      let fileName = "Informe_Deudas";
      if (reportType === "activities") {
        fileName = "Informe_Actividades_Adeudadas";
      } else if (reportType === "monthly") {
        fileName = "Informe_Cuotas_Adeudadas";
      } else {
        fileName = "Informe_Deudas_General";
      }
      fileName += `_${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(fileName);
      toast.success("Informe PDF generado exitosamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el informe");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDebtCertificates = async () => {
    setLoading(true);
    try {
      // Calcular créditos usados primero
      const monthlyCreditsUsed = await calculateMonthlyCreditsUsed();

      // Calcular deudas de todos los estudiantes
      const monthlyDebts = await calculateMonthlyDebts();
      const activityDebts = await calculateActivityDebts(monthlyCreditsUsed);

      // Filtrar solo estudiantes con deuda
      const studentsWithDebt = new Map<string, { monthly: number; activities: { name: string; amount: number }[]; months: string[] }>();

      monthlyDebts.forEach(debt => {
        if (debt.total_owed > 0) {
          studentsWithDebt.set(debt.student_name, {
            monthly: debt.total_owed,
            activities: [],
            months: debt.months_owed
          });
        }
      });

      activityDebts.forEach(debt => {
        if (debt.amount_owed > 0) {
          const existing = studentsWithDebt.get(debt.student_name) || { monthly: 0, activities: [], months: [] };
          existing.activities.push({ name: debt.activity_name, amount: debt.amount_owed });
          studentsWithDebt.set(debt.student_name, existing);
        }
      });

      if (studentsWithDebt.size === 0) {
        toast.info("No hay estudiantes con deudas pendientes");
        setLoading(false);
        return;
      }

      // Generar PDF con certificados
      await generateDebtCertificatesPDF(studentsWithDebt);

      toast.success(`Certificados generados para ${studentsWithDebt.size} estudiante(s)`);
    } catch (error) {
      console.error("Error generating certificates:", error);
      toast.error("Error al generar certificados");
    } finally {
      setLoading(false);
    }
  };

  const generateDebtCertificatesPDF = async (studentsWithDebt: Map<string, { monthly: number; activities: { name: string; amount: number }[]; months: string[] }>) => {
    const doc = new jsPDF();
    const currentDate = new Date();
    let isFirstPage = true;

    for (const [studentName, debts] of studentsWithDebt.entries()) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = 15;

      // Logo
      try {
        const img = new Image();
        img.src = logoImage;
        doc.addImage(img, "PNG", margin, yPos, 25, 25);
      } catch (error) {
        console.error("Error loading logo:", error);
      }

      // Título
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("CERTIFICADO DE DEUDA", pageWidth / 2, yPos + 10, { align: "center" });

      yPos += 30;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha de emisión: ${currentDate.toLocaleDateString("es-CL")}`, pageWidth - margin, yPos, { align: "right" });

      yPos += 15;

      // Encabezado del estudiante
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("APODERADO DE:", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(studentName, margin + 40, yPos);

      yPos += 15;

      // Detalle de deudas
      doc.setFont("helvetica", "bold");
      doc.text("DETALLE DE DEUDAS PENDIENTES:", margin, yPos);
      yPos += 10;

      // Cuotas mensuales
      if (debts.monthly > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Cuotas Mensuales:", margin + 5, yPos);
        yPos += 7;

        if (debts.months.length > 0) {
          const monthsText = `  Meses: ${debts.months.join(", ")}`;
          const splitMonths = doc.splitTextToSize(monthsText, pageWidth - margin * 2 - 10);
          doc.text(splitMonths, margin + 5, yPos);
          yPos += splitMonths.length * 5;
        }

        doc.setFont("helvetica", "bold");
        doc.text(`  Monto: $${debts.monthly.toLocaleString("es-CL")}`, margin + 5, yPos);
        yPos += 10;
      }

      // Actividades
      if (debts.activities.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Actividades:", margin + 5, yPos);
        yPos += 7;

        debts.activities.forEach(activity => {
          doc.text(`  • ${activity.name}`, margin + 5, yPos);
          yPos += 5;
          doc.setFont("helvetica", "bold");
          doc.text(`    Monto: $${activity.amount.toLocaleString("es-CL")}`, margin + 5, yPos);
          doc.setFont("helvetica", "normal");
          yPos += 7;
        });
      }

      yPos += 5;

      // Total
      const totalDebt = debts.monthly + debts.activities.reduce((sum, a) => sum + a.amount, 0);
      doc.setDrawColor(200, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0);
      doc.text("TOTAL ADEUDADO:", margin + 5, yPos);
      doc.text(`$${totalDebt.toLocaleString("es-CL")}`, pageWidth - margin - 5, yPos, { align: "right" });
      doc.setTextColor(0, 0, 0);

      yPos += 15;
      doc.setLineWidth(0.3);
      doc.setDrawColor(0, 0, 0);
      doc.line(margin, yPos, pageWidth - margin, yPos);

      // Texto de validez
      yPos += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100);
      const validityText = `Este certificado tiene validez a la fecha de emisión y refleja el estado de deuda al ${currentDate.toLocaleDateString("es-CL")}.`;
      const splitText = doc.splitTextToSize(validityText, pageWidth - margin * 2);
      doc.text(splitText, margin, yPos);
      yPos += splitText.length * 5 + 10;

      doc.setTextColor(0, 0, 0);

      // Firma directiva
      const firmaYPos = pageHeight - 70;
      try {
        const firmaImg = new Image();
        firmaImg.src = firmaImage;
        // Mantener proporción del logo (aproximadamente 3:1 ancho:alto)
        doc.addImage(firmaImg, "PNG", pageWidth / 2 - 30, firmaYPos - 25, 60, 25);
      } catch (error) {
        console.error("Error loading signature:", error);
      }

      doc.setLineWidth(0.3);
      doc.line(pageWidth / 2 - 35, firmaYPos, pageWidth / 2 + 35, firmaYPos);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Directiva Pre Kinder B", pageWidth / 2, firmaYPos + 5, { align: "center" });

      // Espacio para firma del apoderado
      const apoderadoYPos = pageHeight - 35;
      doc.setLineWidth(0.3);
      doc.line(margin + 10, apoderadoYPos, pageWidth / 2 - 10, apoderadoYPos);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      const firmaApoderadoX = margin + 10 + (pageWidth / 2 - 10 - margin - 10) / 2;
      doc.text("Firma del Apoderado", firmaApoderadoX, apoderadoYPos + 5, { align: "center" });

      doc.line(pageWidth / 2 + 10, apoderadoYPos, pageWidth - margin - 10, apoderadoYPos);
      const fechaRecepcionX = pageWidth / 2 + 10 + (pageWidth - margin - 10 - pageWidth / 2 - 10) / 2;
      doc.text("Fecha de Recepción", fechaRecepcionX, apoderadoYPos + 5, { align: "center" });
    }

    doc.save(`Certificados_Deuda_${currentDate.toLocaleDateString("es-CL").replace(/\//g, "-")}.pdf`);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <img src={logoImage} alt="Logo Colegio" className="w-16 h-16" />
        <div>
          <h1 className="text-4xl font-bold">Reportes de Deudas</h1>
          <p className="text-muted-foreground">
            Genere informes de deudas para compartir
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurar Informe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Tipo de Deuda</Label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
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
              <Select value={scope} onValueChange={(value: any) => setScope(value)}>
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

            {(reportType === "monthly" || reportType === "both") && (
              <>
                <div className="space-y-2">
                  <Label>Detalle de Cuotas</Label>
                  <Select value={monthlyDetailType} onValueChange={(value: any) => setMonthlyDetailType(value)}>
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
                  <Select value={monthlyPeriod} onValueChange={(value: any) => setMonthlyPeriod(value)}>
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
              disabled={loading}
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
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  Revise las deudas antes de generar el PDF
                </p>
              </div>
              {(previewMonthlyDebts.length > 0 || previewActivityDebts.length > 0) && (
                <Button
                  onClick={generatePDF}
                  disabled={loading}
                  size="sm"
                  className="h-8 md:h-10 text-xs md:text-sm"
                >
                  <FileText className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                  {loading ? "Generando..." : "Generar PDF"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {previewMonthlyDebts.length === 0 && previewActivityDebts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay deudas pendientes según los criterios seleccionados
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
                          <TableRow key={index}>
                            <TableCell className="font-medium">{debt.student_name}</TableCell>
                            {monthlyDetailType === "detailed" && (
                              <TableCell>{debt.months_owed.join(", ")}</TableCell>
                            )}
                            <TableCell className="text-right font-semibold text-red-600">
                              ${debt.total_owed.toLocaleString("es-CL")}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-red-50 font-bold">
                          <TableCell colSpan={monthlyDetailType === "detailed" ? 2 : 1}>
                            TOTAL
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            ${previewMonthlyDebts.reduce((sum, d) => sum + d.total_owed, 0).toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
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
                          <TableRow key={index}>
                            <TableCell className="font-medium">{debt.student_name}</TableCell>
                            <TableCell>{debt.activity_name}</TableCell>
                            <TableCell className="text-right font-semibold text-red-600">
                              ${debt.amount_owed.toLocaleString("es-CL")}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-red-50 font-bold">
                          <TableCell colSpan={2}>TOTAL</TableCell>
                          <TableCell className="text-right text-red-600">
                            ${previewActivityDebts.reduce((sum, d) => sum + d.amount_owed, 0).toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
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
          <p>• Para cuotas mensuales, elija entre resumen total o desglose por meses</p>
          <p>• Consulte las deudas para ver una vista previa antes de generar el PDF</p>
          <p>• El informe PDF incluirá solo los estudiantes con deudas pendientes</p>
          <p>• Puede compartir el PDF generado directamente en WhatsApp</p>
        </CardContent>
      </Card>
    </div>
  );
}
