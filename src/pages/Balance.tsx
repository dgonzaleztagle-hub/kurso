import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import logoImage from "@/assets/logo-colegio.png";
import firmaImage from "@/assets/firma-directiva.png";
import { ArrowUpCircle, ArrowDownCircle, Wallet, FileText } from "lucide-react";
import jsPDF from "jspdf";

interface Payment {
  id: number;
  concept: string;
  amount: number;
  payment_date: string;
}

interface Expense {
  id: number;
  concept: string;
  amount: number;
  expense_date: string;
}

interface DetailedItem {
  concept: string;
  count: number;
  amount: number;
}

export default function Balance() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [viewType, setViewType] = useState<"detailed" | "summary">("summary");
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"income" | "expense" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [paymentsResult, expensesResult] = await Promise.all([
        supabase.from("payments").select("*"),
        supabase.from("expenses").select("*")
      ]);

      if (paymentsResult.error) throw paymentsResult.error;
      if (expensesResult.error) throw expensesResult.error;

      setPayments(paymentsResult.data || []);
      setExpenses(expensesResult.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  // Calculate detailed balance (grouped by concept)
  const calculateDetailed = () => {
    const incomeByGlosa = new Map<string, { count: number; amount: number }>();
    const expenseByGlosa = new Map<string, { count: number; amount: number }>();

    payments.forEach(payment => {
      const existing = incomeByGlosa.get(payment.concept) || { count: 0, amount: 0 };
      incomeByGlosa.set(payment.concept, {
        count: existing.count + 1,
        amount: existing.amount + Number(payment.amount)
      });
    });

    expenses.forEach(expense => {
      const existing = expenseByGlosa.get(expense.concept) || { count: 0, amount: 0 };
      expenseByGlosa.set(expense.concept, {
        count: existing.count + 1,
        amount: existing.amount + Number(expense.amount)
      });
    });

    const incomeItems: DetailedItem[] = Array.from(incomeByGlosa.entries()).map(([concept, data]) => ({
      concept,
      count: data.count,
      amount: data.amount
    }));

    const expenseItems: DetailedItem[] = Array.from(expenseByGlosa.entries()).map(([concept, data]) => ({
      concept,
      count: data.count,
      amount: data.amount
    }));

    return { incomeItems, expenseItems };
  };

  // Calculate summary balance (grouped by category)
  const calculateSummary = () => {
    const incomeCategories = new Map<string, number>();
    const expenseCategories = new Map<string, number>();

    payments.forEach(payment => {
      let category = "Otros Ingresos";
      const conceptUpper = payment.concept.toUpperCase();
      
      if (conceptUpper.includes("CUOTA")) {
        category = "Cuotas Mensuales";
      } else if (conceptUpper.includes("ACTIVIDAD") || conceptUpper.includes("DIA DEL") || 
                 conceptUpper.includes("APORTE") || conceptUpper.includes("RIFA") ||
                 conceptUpper.includes("POLERA")) {
        category = "Actividades";
      }

      const current = incomeCategories.get(category) || 0;
      incomeCategories.set(category, current + Number(payment.amount));
    });

    expenses.forEach(expense => {
      let category = "Otros Egresos";
      const conceptUpper = expense.concept.toUpperCase();
      
      if (conceptUpper.includes("MATERIALES") || conceptUpper.includes("ÚTILES")) {
        category = "Materiales y Útiles";
      } else if (conceptUpper.includes("ALIMENTO") || conceptUpper.includes("COMIDA")) {
        category = "Alimentación";
      } else if (conceptUpper.includes("SERVICIO") || conceptUpper.includes("CUENTA")) {
        category = "Servicios";
      }

      const current = expenseCategories.get(category) || 0;
      expenseCategories.set(category, current + Number(expense.amount));
    });

    const incomeItems: DetailedItem[] = Array.from(incomeCategories.entries()).map(([concept, amount]) => ({
      concept,
      count: 1,
      amount
    }));

    const expenseItems: DetailedItem[] = Array.from(expenseCategories.entries()).map(([concept, amount]) => ({
      concept,
      count: 1,
      amount
    }));

    return { incomeItems, expenseItems };
  };

  const totalIncome = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const balance = totalIncome - totalExpenses;

  const { incomeItems, expenseItems } = viewType === "detailed" 
    ? calculateDetailed() 
    : calculateSummary();

  const handleCategoryClick = (category: string, type: "income" | "expense") => {
    if (viewType === "summary") {
      setSelectedCategory(category);
      setSelectedType(type);
      setDialogOpen(true);
    }
  };

  const getDetailedItemsForCategory = () => {
    if (!selectedCategory || !selectedType) return [];

    const conceptsMap = new Map<string, { count: number; amount: number }>();
    
    if (selectedType === "income") {
      payments.forEach(payment => {
        let category = "Otros Ingresos";
        const conceptUpper = payment.concept.toUpperCase();
        
        if (conceptUpper.includes("CUOTA")) {
          category = "Cuotas Mensuales";
        } else if (conceptUpper.includes("ACTIVIDAD") || conceptUpper.includes("DIA DEL") || 
                   conceptUpper.includes("APORTE") || conceptUpper.includes("RIFA") ||
                   conceptUpper.includes("POLERA")) {
          category = "Actividades";
        }

        if (category === selectedCategory) {
          const existing = conceptsMap.get(payment.concept) || { count: 0, amount: 0 };
          conceptsMap.set(payment.concept, {
            count: existing.count + 1,
            amount: existing.amount + Number(payment.amount)
          });
        }
      });
    } else {
      expenses.forEach(expense => {
        let category = "Otros Egresos";
        const conceptUpper = expense.concept.toUpperCase();
        
        if (conceptUpper.includes("MATERIALES") || conceptUpper.includes("ÚTILES")) {
          category = "Materiales y Útiles";
        } else if (conceptUpper.includes("ALIMENTO") || conceptUpper.includes("COMIDA")) {
          category = "Alimentación";
        } else if (conceptUpper.includes("SERVICIO") || conceptUpper.includes("CUENTA")) {
          category = "Servicios";
        }

        if (category === selectedCategory) {
          const existing = conceptsMap.get(expense.concept) || { count: 0, amount: 0 };
          conceptsMap.set(expense.concept, {
            count: existing.count + 1,
            amount: existing.amount + Number(expense.amount)
          });
        }
      });
    }

    return Array.from(conceptsMap.entries()).map(([concept, data]) => ({
      concept,
      count: data.count,
      amount: data.amount
    }));
  };

  const generateBalancePDF = async () => {
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

      // Header background
      doc.setFillColor(240, 245, 250);
      doc.rect(0, 0, 210, 36, 'F');
      
      // Logo
      doc.addImage(logoImg, 'PNG', 15, 12, 22, 22);

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("INFORME DE BALANCE FINANCIERO", 105, 18, { align: "center" });
      
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

      // Summary boxes
      doc.setFillColor(237, 247, 237);
      doc.roundedRect(15, yPos, 55, 20, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.text("TOTAL INGRESOS", 42.5, yPos + 6, { align: "center" });
      doc.setFontSize(12);
      doc.text(`$${totalIncome.toLocaleString("es-CL")}`, 42.5, yPos + 14, { align: "center" });

      doc.setFillColor(254, 242, 242);
      doc.roundedRect(77.5, yPos, 55, 20, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text("TOTAL EGRESOS", 105, yPos + 6, { align: "center" });
      doc.setFontSize(12);
      doc.text(`$${totalExpenses.toLocaleString("es-CL")}`, 105, yPos + 14, { align: "center" });

      const balanceColor = balance >= 0 ? [30, 58, 138] : [220, 38, 38];
      doc.setFillColor(balance >= 0 ? 240 : 254, balance >= 0 ? 245 : 242, balance >= 0 ? 255 : 242);
      doc.roundedRect(140, yPos, 55, 20, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
      doc.text("SALDO BANCO", 167.5, yPos + 6, { align: "center" });
      doc.setFontSize(12);
      doc.text(`$${balance.toLocaleString("es-CL")}`, 167.5, yPos + 14, { align: "center" });

      yPos += 30;

      // Income Table
      doc.setFillColor(237, 242, 247);
      doc.rect(15, yPos - 3, 180, 7, 'F');
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.text(`INGRESOS ${viewType === "detailed" ? "POR GLOSA" : "POR CATEGORÍA"}`, 17, yPos + 1);
      yPos += 10;

      // Income table header
      doc.setFillColor(237, 242, 247);
      doc.rect(15, yPos - 3, 180, 8, 'F');
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text(viewType === "detailed" ? "Glosa" : "Categoría", 20, yPos + 2);
      if (viewType === "detailed") {
        doc.text("Cant.", 140, yPos + 2);
      }
      doc.text("Monto", 185, yPos + 2, { align: "right" });
      yPos += 10;

      // Income items
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      incomeItems.forEach((item, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        if (index % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(17, yPos - 2, 176, 6, 'F');
        }

        doc.setTextColor(51, 65, 85);
        const conceptText = item.concept.length > 60 ? item.concept.substring(0, 57) + "..." : item.concept;
        doc.text(conceptText, 20, yPos);
        if (viewType === "detailed") {
          doc.text(item.count.toString(), 140, yPos);
        }
        doc.setTextColor(34, 197, 94);
        doc.text(`$${item.amount.toLocaleString("es-CL")}`, 190, yPos, { align: "right" });
        yPos += 6;
      });

      // Income total
      doc.setFillColor(237, 247, 237);
      doc.rect(15, yPos - 2, 180, 8, 'F');
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(10);
      doc.text("TOTAL INGRESOS", 20, yPos + 2);
      doc.text(`$${totalIncome.toLocaleString("es-CL")}`, 190, yPos + 2, { align: "right" });
      yPos += 15;

      // Expense Table
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(237, 242, 247);
      doc.rect(15, yPos - 3, 180, 7, 'F');
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text(`EGRESOS ${viewType === "detailed" ? "POR GLOSA" : "POR CATEGORÍA"}`, 17, yPos + 1);
      yPos += 10;

      // Expense table header
      doc.setFillColor(237, 242, 247);
      doc.rect(15, yPos - 3, 180, 8, 'F');
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text(viewType === "detailed" ? "Glosa" : "Categoría", 20, yPos + 2);
      if (viewType === "detailed") {
        doc.text("Cant.", 140, yPos + 2);
      }
      doc.text("Monto", 185, yPos + 2, { align: "right" });
      yPos += 10;

      // Expense items
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      expenseItems.forEach((item, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        if (index % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(17, yPos - 2, 176, 6, 'F');
        }

        doc.setTextColor(51, 65, 85);
        const conceptText = item.concept.length > 60 ? item.concept.substring(0, 57) + "..." : item.concept;
        doc.text(conceptText, 20, yPos);
        if (viewType === "detailed") {
          doc.text(item.count.toString(), 140, yPos);
        }
        doc.setTextColor(220, 38, 38);
        doc.text(`$${item.amount.toLocaleString("es-CL")}`, 190, yPos, { align: "right" });
        yPos += 6;
      });

      // Expense total
      doc.setFillColor(254, 242, 242);
      doc.rect(15, yPos - 2, 180, 8, 'F');
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(10);
      doc.text("TOTAL EGRESOS", 20, yPos + 2);
      doc.text(`$${totalExpenses.toLocaleString("es-CL")}`, 190, yPos + 2, { align: "right" });
      yPos += 15;

      // Final balance
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(balance >= 0 ? 240 : 254, balance >= 0 ? 245 : 242, balance >= 0 ? 255 : 242);
      doc.rect(15, yPos - 2, 180, 12, 'F');
      doc.setFont("helvetica", "bold");
      doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
      doc.setFontSize(12);
      doc.text("SALDO FINAL", 20, yPos + 4);
      doc.setFontSize(14);
      doc.text(`$${balance.toLocaleString("es-CL")}`, 190, yPos + 4, { align: "right" });

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
      const fileName = `Balance_Financiero_${viewType === "detailed" ? "Detallado" : "Resumen"}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success("Informe PDF generado exitosamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el informe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logoImage} alt="Logo Colegio" className="w-16 h-16" />
          <div>
            <h1 className="text-4xl font-bold">Balance Financiero</h1>
            <p className="text-muted-foreground">
              Resumen de ingresos, egresos y saldo actual
            </p>
          </div>
        </div>
        <Button onClick={generateBalancePDF} disabled={loading}>
          <FileText className="mr-2 h-4 w-4" />
          {loading ? "Generando..." : "Generar PDF"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalIncome.toLocaleString("es-CL")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Egresos</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalExpenses.toLocaleString("es-CL")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Banco</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-primary' : 'text-red-600'}`}>
              ${balance.toLocaleString("es-CL")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Tipo de Vista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Seleccione el tipo de detalle</Label>
            <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Resumen por Categoría</SelectItem>
                <SelectItem value="detailed">Detallado por Glosa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Income Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">
            Ingresos {viewType === "detailed" ? "por Glosa" : "por Categoría"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{viewType === "detailed" ? "Glosa" : "Categoría"}</TableHead>
                {viewType === "detailed" && <TableHead className="text-right">Cantidad</TableHead>}
                <TableHead className="text-right">Monto Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomeItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={viewType === "detailed" ? 3 : 2} className="text-center text-muted-foreground">
                    No hay ingresos registrados
                  </TableCell>
                </TableRow>
              ) : (
                incomeItems.map((item, index) => (
                  <TableRow 
                    key={index}
                    className={viewType === "summary" ? "cursor-pointer hover:bg-green-50" : ""}
                    onClick={() => viewType === "summary" && handleCategoryClick(item.concept, "income")}
                  >
                    <TableCell className="font-medium">{item.concept}</TableCell>
                    {viewType === "detailed" && (
                      <TableCell className="text-right">{item.count}</TableCell>
                    )}
                    <TableCell className="text-right font-semibold text-green-600">
                      ${item.amount.toLocaleString("es-CL")}
                    </TableCell>
                  </TableRow>
                ))
              )}
              <TableRow className="bg-green-50 font-bold">
                <TableCell>TOTAL INGRESOS</TableCell>
                {viewType === "detailed" && <TableCell></TableCell>}
                <TableCell className="text-right text-green-600">
                  ${totalIncome.toLocaleString("es-CL")}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">
            Egresos {viewType === "detailed" ? "por Glosa" : "por Categoría"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{viewType === "detailed" ? "Glosa" : "Categoría"}</TableHead>
                {viewType === "detailed" && <TableHead className="text-right">Cantidad</TableHead>}
                <TableHead className="text-right">Monto Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={viewType === "detailed" ? 3 : 2} className="text-center text-muted-foreground">
                    No hay egresos registrados
                  </TableCell>
                </TableRow>
              ) : (
                expenseItems.map((item, index) => (
                  <TableRow 
                    key={index}
                    className={viewType === "summary" ? "cursor-pointer hover:bg-red-50" : ""}
                    onClick={() => viewType === "summary" && handleCategoryClick(item.concept, "expense")}
                  >
                    <TableCell className="font-medium">{item.concept}</TableCell>
                    {viewType === "detailed" && (
                      <TableCell className="text-right">{item.count}</TableCell>
                    )}
                    <TableCell className="text-right font-semibold text-red-600">
                      ${item.amount.toLocaleString("es-CL")}
                    </TableCell>
                  </TableRow>
                ))
              )}
              <TableRow className="bg-red-50 font-bold">
                <TableCell>TOTAL EGRESOS</TableCell>
                {viewType === "detailed" && <TableCell></TableCell>}
                <TableCell className="text-right text-red-600">
                  ${totalExpenses.toLocaleString("es-CL")}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Final Balance */}
      <Card className={balance >= 0 ? "border-primary" : "border-red-600"}>
        <CardHeader>
          <CardTitle className={balance >= 0 ? "text-primary" : "text-red-600"}>
            Saldo Final
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center text-lg">
            <span className="font-medium">Ingresos - Egresos =</span>
            <span className={`text-3xl font-bold ${balance >= 0 ? 'text-primary' : 'text-red-600'}`}>
              ${balance.toLocaleString("es-CL")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Detalle de {selectedCategory}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getDetailedItemsForCategory().map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.concept}</TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                    <TableCell className={`text-right font-semibold ${selectedType === "income" ? "text-green-600" : "text-red-600"}`}>
                      ${item.amount.toLocaleString("es-CL")}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className={selectedType === "income" ? "bg-green-50 font-bold" : "bg-red-50 font-bold"}>
                  <TableCell colSpan={2}>TOTAL</TableCell>
                  <TableCell className={`text-right ${selectedType === "income" ? "text-green-600" : "text-red-600"}`}>
                    ${getDetailedItemsForCategory().reduce((sum, item) => sum + item.amount, 0).toLocaleString("es-CL")}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
