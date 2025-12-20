import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatDateForDisplay } from "@/lib/dateUtils";
import * as XLSX from "xlsx";
import { generateExpenseReceipt } from "@/lib/receiptGenerator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Expense {
  id: number;
  folio: number;
  supplier: string;
  expense_date: string;
  amount: number;
  concept: string;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    const filtered = expenses.filter(
      (expense) =>
        expense.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.concept.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredExpenses(filtered);
  }, [searchTerm, expenses]);

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
      setFilteredExpenses(data || []);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast.error("Error al cargar egresos");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  const exportToExcel = () => {
    try {
      const dataToExport = expenses.map((expense) => ({
        Folio: expense.folio,
        Fecha: formatDateForDisplay(expense.expense_date),
        Proveedor: expense.supplier,
        Concepto: expense.concept,
        Monto: expense.amount,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Egresos");

      // Auto-size columns
      const maxWidth = 25;
      const wscols = [
        { wch: 10 },
        { wch: 12 },
        { wch: maxWidth },
        { wch: maxWidth },
        { wch: 15 },
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `Egresos_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
      toast.success("Archivo Excel exportado exitosamente");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Error al exportar a Excel");
    }
  };

  const handleDeleteClick = (expense: Expense) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!expenseToDelete) return;

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseToDelete.id);

      if (error) throw error;

      toast.success("Egreso eliminado exitosamente");
      loadExpenses();
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Error al eliminar el egreso");
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleGenerateReceipt = async (expense: Expense) => {
    try {
      await generateExpenseReceipt({
        folio: expense.folio,
        supplier: expense.supplier,
        expenseDate: expense.expense_date,
        amount: expense.amount,
        concept: expense.concept
      });
      toast.success("Comprobante generado exitosamente");
    } catch (error) {
      console.error("Error generating receipt:", error);
      toast.error("Error al generar el comprobante");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Egresos</h1>
        <p className="text-muted-foreground text-sm md:text-base">Historial de egresos registrados</p>
      </div>

      {/* Listado de egresos */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
            <CardTitle className="text-base md:text-lg">Historial de Egresos</CardTitle>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <Button onClick={exportToExcel} disabled={expenses.length === 0} variant="outline" size="sm" className="text-xs md:text-sm h-8 md:h-10">
                <Download className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                Exportar Excel
              </Button>
              <div className="text-right">
                <p className="text-xs md:text-sm text-muted-foreground">Total Egresos</p>
                <p className="text-lg md:text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 md:mt-4">
            <Search className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-xs md:h-10 md:text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No se encontraron egresos" : "No hay egresos registrados"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.folio}</TableCell>
                      <TableCell>
                        {formatDateForDisplay(expense.expense_date)}
                      </TableCell>
                      <TableCell>{expense.supplier}</TableCell>
                      <TableCell className="max-w-xs truncate">{expense.concept}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {formatCurrency(Number(expense.amount))}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateReceipt(expense)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(expense)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar egreso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el egreso #{expenseToDelete?.folio} de forma permanente.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExpenseToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}