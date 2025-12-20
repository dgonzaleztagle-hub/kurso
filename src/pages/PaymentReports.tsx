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

interface Student {
  id: number;
  name: string;
  enrollment_date: string;
}

interface Activity {
  id: number;
  name: string;
  amount: number;
  activity_date: string;
}

interface Payment {
  id: number;
  payment_date: string;
  concept: string;
  amount: number;
  folio: number;
  student_name?: string;
}

export default function PaymentReports() {
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchType, setSearchType] = useState<"student" | "activity">("student");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [period, setPeriod] = useState<"current" | "year">("current");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStudents();
    loadActivities();
  }, []);

  useEffect(() => {
    if (searchType === "student" && selectedStudent) {
      loadPaymentsByStudent();
    } else if (searchType === "activity" && selectedActivity) {
      loadPaymentsByActivity();
    }
  }, [searchType, selectedStudent, selectedActivity, period]);

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("name");

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Error al cargar estudiantes");
    }
  };

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
    }
  };

  const loadPaymentsByStudent = async () => {
    if (!selectedStudent) return;

    try {
      setLoading(true);
      let query = supabase
        .from("payments")
        .select("*")
        .eq("student_id", parseInt(selectedStudent))
        .order("payment_date", { ascending: false });

      if (period === "current") {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const startDate = new Date(currentYear, 0, 1).toISOString();
        const endDate = currentDate.toISOString();
        
        query = query.gte("payment_date", startDate).lte("payment_date", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Error loading payments:", error);
      toast.error("Error al cargar pagos");
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentsByActivity = async () => {
    if (!selectedActivity) return;

    try {
      setLoading(true);
      let query = supabase
        .from("payments")
        .select("*")
        .eq("activity_id", parseInt(selectedActivity))
        .order("payment_date", { ascending: false });

      if (period === "current") {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const startDate = new Date(currentYear, 0, 1).toISOString();
        const endDate = currentDate.toISOString();
        
        query = query.gte("payment_date", startDate).lte("payment_date", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Error loading payments:", error);
      toast.error("Error al cargar pagos");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (payments.length === 0) {
      toast.error("No hay pagos registrados para generar el informe");
      return;
    }

    if (searchType === "student" && !selectedStudent) {
      toast.error("Seleccione un estudiante");
      return;
    }

    if (searchType === "activity" && !selectedActivity) {
      toast.error("Seleccione una actividad");
      return;
    }

    try {
      setLoading(true);
      const doc = new jsPDF();
      
      const student = searchType === "student" ? students.find(s => s.id.toString() === selectedStudent) : null;
      const activity = searchType === "activity" ? activities.find(a => a.id.toString() === selectedActivity) : null;

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

      // Header background
      doc.setFillColor(240, 245, 250);
      doc.rect(0, 0, 210, 36, 'F');
      
      // Logo
      doc.addImage(logoImg, 'PNG', 15, 12, 22, 22);

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("INFORME DE PAGOS REALIZADOS", 105, 18, { align: "center" });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Pre Kinder B - Colegio Santa Cruz", 105, 24, { align: "center" });
      doc.text(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, 105, 28, { align: "center" });

      // Separator line
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(15, 34, 195, 34);

      let yPos = 45;

      // Info based on search type
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      if (searchType === "student" && student) {
        doc.text(`Estudiante: ${student.name}`, 15, yPos);
      } else if (searchType === "activity" && activity) {
        doc.text(`Actividad: ${activity.name}`, 15, yPos);
      }
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Período: ${period === "current" ? "Hasta la fecha" : "Todo el año"}`, 15, yPos);
      yPos += 10;

      // Table header
      doc.setFillColor(237, 242, 247);
      doc.rect(15, yPos - 3, 180, 8, 'F');
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("Fecha", 20, yPos + 2);
      doc.text("Folio", 45, yPos + 2);
      if (searchType === "activity") {
        doc.text("Estudiante", 70, yPos + 2);
      } else {
        doc.text("Concepto", 70, yPos + 2);
      }
      doc.text("Monto", 170, yPos + 2);
      yPos += 10;

      // Table rows
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(8);

      let total = 0;
      payments.forEach((payment, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        // Alternating background
        if (index % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(17, yPos - 2, 176, 6, 'F');
        }

        doc.text(new Date(payment.payment_date).toLocaleDateString("es-CL"), 20, yPos);
        doc.text(payment.folio.toString(), 45, yPos);
        
        if (searchType === "activity") {
          // Show student name
          const displayText = payment.student_name || "Sin nombre";
          const truncatedText = displayText.length > 50 
            ? displayText.substring(0, 47) + "..."
            : displayText;
          doc.text(truncatedText, 70, yPos);
        } else {
          // Show concept
          const concept = payment.concept.length > 50 
            ? payment.concept.substring(0, 47) + "..."
            : payment.concept;
          doc.text(concept, 70, yPos);
        }
        
        doc.setTextColor(34, 197, 94);
        doc.text(`$${Number(payment.amount).toLocaleString("es-CL")}`, 190, yPos, { align: "right" });
        doc.setTextColor(51, 65, 85);
        
        total += Number(payment.amount);
        yPos += 6;
      });

      // Total
      yPos += 5;
      doc.setFillColor(237, 242, 247);
      doc.rect(15, yPos - 3, 180, 8, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(10);
      doc.text("TOTAL PAGADO:", 130, yPos + 2);
      doc.setTextColor(34, 197, 94);
      doc.text(`$${total.toLocaleString("es-CL")}`, 190, yPos + 2, { align: "right" });

      // Signature
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }

      const signatureYPos = pageHeight - 45;
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(15, signatureYPos, 195, signatureYPos);
      doc.addImage(firmaImg, 'PNG', pageWidth - 62, signatureYPos + 5, 47, 35);

      // Save
      let fileName = "";
      if (searchType === "student" && student) {
        fileName = `Informe_Pagos_${student.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      } else if (searchType === "activity" && activity) {
        fileName = `Informe_Pagos_${activity.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      }
      doc.save(fileName);
      toast.success("Informe PDF generado exitosamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el informe");
    } finally {
      setLoading(false);
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <img src={logoImage} alt="Logo Colegio" className="w-16 h-16" />
        <div>
          <h1 className="text-4xl font-bold">Informe de Pagos Realizados</h1>
          <p className="text-muted-foreground">
            Consulte todos los pagos realizados por estudiante
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-xl">Configurar Informe</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 space-y-3 md:space-y-6">
          <div className="space-y-1 md:space-y-2">
            <Label className="text-xs md:text-sm">Buscar por</Label>
            <Select value={searchType} onValueChange={(value: any) => {
              setSearchType(value);
              setSelectedStudent("");
              setSelectedActivity("");
              setPayments([]);
            }}>
              <SelectTrigger className="h-8 md:h-10 text-xs md:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Alumno</SelectItem>
                <SelectItem value="activity">Actividad</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {searchType === "student" ? (
              <div className="space-y-2">
                <Label>Estudiante</Label>
                <StudentCombobox
                  students={students}
                  value={selectedStudent}
                  onValueChange={setSelectedStudent}
                  placeholder="Buscar estudiante..."
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Actividad</Label>
                <Select value={selectedActivity} onValueChange={setSelectedActivity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar actividad..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activities.map((activity) => (
                      <SelectItem key={activity.id} value={activity.id.toString()}>
                        {activity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Hasta la fecha</SelectItem>
                  <SelectItem value="year">Todo el año</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        </CardContent>
      </Card>

      {(selectedStudent || selectedActivity) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pagos Realizados</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Total: ${totalPaid.toLocaleString("es-CL")}
                </p>
              </div>
              {payments.length > 0 && (
                <Button 
                  onClick={generatePDF} 
                  disabled={loading}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {loading ? "Generando..." : "Generar PDF"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay pagos registrados en el período seleccionado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Folio</TableHead>
                    {searchType === "activity" ? (
                      <TableHead>Estudiante</TableHead>
                    ) : (
                      <TableHead>Concepto</TableHead>
                    )}
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {new Date(payment.payment_date).toLocaleDateString("es-CL")}
                      </TableCell>
                      <TableCell>{payment.folio}</TableCell>
                      {searchType === "activity" ? (
                        <TableCell>{payment.student_name || "Sin nombre"}</TableCell>
                      ) : (
                        <TableCell>{payment.concept}</TableCell>
                      )}
                      <TableCell className="text-right font-semibold text-green-600">
                        ${Number(payment.amount).toLocaleString("es-CL")}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-green-50 font-bold">
                    <TableCell colSpan={3}>TOTAL</TableCell>
                    <TableCell className="text-right text-green-600">
                      ${totalPaid.toLocaleString("es-CL")}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
