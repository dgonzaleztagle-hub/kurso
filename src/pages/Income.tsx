import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateForDisplay } from "@/lib/dateUtils";
import { Download, Search, X, FileText, Pencil, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { generatePaymentReceipt } from "@/lib/receiptGenerator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Payment {
  id: number;
  folio: number;
  student_id: number | null;
  student_name: string | null;
  payment_date: string;
  concept: string;
  month_period: string | null;
  amount: number;
}

export default function Income() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);
  
  // Filtros
  const [searchStudent, setSearchStudent] = useState("");
  const [searchConcept, setSearchConcept] = useState("");
  const [searchFolio, setSearchFolio] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Estados para edición
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    payment_date: "",
    concept: "",
    amount: 0,
    student_name: "",
  });

  // Estados para eliminación
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadPayments();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        () => {
          loadPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [payments, searchStudent, searchConcept, searchFolio, startDate, endDate]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPayments(data || []);
      setFilteredPayments(data || []);
      
      // Calculate total income
      const total = (data || []).reduce((sum, payment) => sum + Number(payment.amount), 0);
      setTotalIncome(total);
    } catch (error) {
      console.error("Error loading payments:", error);
      toast.error("Error al cargar los pagos");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...payments];

    // Filtro por estudiante
    if (searchStudent) {
      filtered = filtered.filter(p => 
        p.student_name?.toLowerCase().includes(searchStudent.toLowerCase())
      );
    }

    // Filtro por concepto
    if (searchConcept) {
      filtered = filtered.filter(p => 
        p.concept.toLowerCase().includes(searchConcept.toLowerCase())
      );
    }

    // Filtro por folio
    if (searchFolio) {
      filtered = filtered.filter(p => 
        p.folio.toString().includes(searchFolio)
      );
    }

    // Filtro por rango de fechas
    if (startDate) {
      filtered = filtered.filter(p => 
        new Date(p.payment_date) >= new Date(startDate)
      );
    }

    if (endDate) {
      filtered = filtered.filter(p => 
        new Date(p.payment_date) <= new Date(endDate)
      );
    }

    setFilteredPayments(filtered);
    
    // Recalcular total filtrado
    const total = filtered.reduce((sum, payment) => sum + payment.amount, 0);
    setTotalIncome(total);
  };

  const clearFilters = () => {
    setSearchStudent("");
    setSearchConcept("");
    setSearchFolio("");
    setStartDate("");
    setEndDate("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  const exportToExcel = () => {
    try {
      const dataToExport = filteredPayments.map((payment) => ({
        Folio: payment.folio,
        Fecha: format(new Date(payment.payment_date), "dd/MM/yyyy"),
        Estudiante: payment.student_name || "N/A",
        Concepto: payment.concept,
        Período: payment.month_period || "-",
        Monto: payment.amount,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ingresos");

      // Auto-size columns
      const maxWidth = 20;
      const wscols = [
        { wch: 10 },
        { wch: 12 },
        { wch: maxWidth },
        { wch: maxWidth },
        { wch: 12 },
        { wch: 15 },
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `Ingresos_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
      toast.success("Archivo Excel exportado exitosamente");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Error al exportar a Excel");
    }
  };

  const handleGenerateReceipt = async (payment: Payment) => {
    if (!payment.student_id || !payment.student_name) {
      toast.error("Este pago no tiene información de estudiante");
      return;
    }

    try {
      await generatePaymentReceipt({
        folio: payment.folio,
        studentId: payment.student_id,
        studentName: payment.student_name,
        paymentDate: payment.payment_date,
        amount: payment.amount,
        concept: payment.concept
      });
      toast.success("Comprobante generado exitosamente");
    } catch (error) {
      console.error("Error generating receipt:", error);
      toast.error("Error al generar el comprobante");
    }
  };

  const handleEditClick = (payment: Payment) => {
    setEditingPayment(payment);
    setEditFormData({
      payment_date: payment.payment_date,
      concept: payment.concept,
      amount: payment.amount,
      student_name: payment.student_name || "",
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPayment) return;

    try {
      const { error } = await supabase
        .from("payments")
        .update({
          payment_date: editFormData.payment_date,
          concept: editFormData.concept,
          amount: editFormData.amount,
          student_name: editFormData.student_name || null,
        })
        .eq("id", editingPayment.id);

      if (error) throw error;

      toast.success("Pago actualizado exitosamente");
      setShowEditDialog(false);
      setEditingPayment(null);
      loadPayments();
    } catch (error) {
      console.error("Error updating payment:", error);
      toast.error("Error al actualizar el pago");
    }
  };

  const handleDeleteClick = (payment: Payment) => {
    setDeletingPayment(payment);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPayment) return;

    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", deletingPayment.id);

      if (error) throw error;

      toast.success("Pago eliminado exitosamente");
      setShowDeleteDialog(false);
      setDeletingPayment(null);
      loadPayments();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast.error("Error al eliminar el pago");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Ingresos</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Listado de todos los pagos registrados
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-lg md:text-2xl">
            Total de Ingresos: {formatCurrency(totalIncome)}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-xl">Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
            <div className="space-y-1">
              <Label htmlFor="searchFolio" className="text-xs">Folio</Label>
              <Input
                id="searchFolio"
                placeholder="Buscar..."
                value={searchFolio}
                onChange={(e) => setSearchFolio(e.target.value)}
                className="h-8 text-xs md:h-10 md:text-sm"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="searchStudent" className="text-xs">Estudiante</Label>
              <Input
                id="searchStudent"
                placeholder="Buscar..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="h-8 text-xs md:h-10 md:text-sm"
              />
            </div>
            
            <div className="space-y-1 col-span-2 md:col-span-1">
              <Label htmlFor="searchConcept" className="text-xs">Concepto</Label>
              <Input
                id="searchConcept"
                placeholder="Buscar..."
                value={searchConcept}
                onChange={(e) => setSearchConcept(e.target.value)}
                className="h-8 text-xs md:h-10 md:text-sm"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="startDate" className="text-xs">Desde</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs md:h-10 md:text-sm"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="endDate" className="text-xs">Hasta</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs md:h-10 md:text-sm"
              />
            </div>
            
            <div className="space-y-1 flex items-end">
              <Button 
                variant="outline" 
                onClick={clearFilters}
                className="w-full h-8 text-xs md:h-10 md:text-sm"
              >
                <X className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                Limpiar
              </Button>
            </div>
          </div>
          
          <div className="mt-3 md:mt-4 text-xs md:text-sm text-muted-foreground">
            Mostrando {filteredPayments.length} de {payments.length} registros
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0 pb-3 md:pb-6">
          <CardTitle>Historial de Pagos</CardTitle>
          <Button onClick={exportToExcel} disabled={filteredPayments.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar a Excel
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando pagos...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {payments.length === 0 
                ? "No hay pagos registrados" 
                : "No se encontraron pagos con los filtros aplicados"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                 <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.folio}
                      </TableCell>
                      <TableCell>
                        {formatDateForDisplay(payment.payment_date)}
                      </TableCell>
                      <TableCell>{payment.student_name || "N/A"}</TableCell>
                      <TableCell>{payment.concept}</TableCell>
                      <TableCell>{payment.month_period || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateReceipt(payment)}
                            disabled={!payment.student_id || !payment.student_name}
                            title={!payment.student_id || !payment.student_name ? "Pago sin información de estudiante" : "Generar comprobante"}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditClick(payment)}
                            title="Editar pago"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(payment)}
                            title="Eliminar pago"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Dialog de edición */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pago</DialogTitle>
            <DialogDescription>
              Modifica los datos del pago. Folio: {editingPayment?.folio}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Fecha de Pago</Label>
              <Input
                id="edit-date"
                type="date"
                value={editFormData.payment_date}
                onChange={(e) => setEditFormData({ ...editFormData, payment_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-student">Estudiante</Label>
              <Input
                id="edit-student"
                value={editFormData.student_name}
                onChange={(e) => setEditFormData({ ...editFormData, student_name: e.target.value })}
                placeholder="Nombre del estudiante"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-concept">Concepto</Label>
              <Input
                id="edit-concept"
                value={editFormData.concept}
                onChange={(e) => setEditFormData({ ...editFormData, concept: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-amount">Monto</Label>
              <Input
                id="edit-amount"
                type="number"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: Number(e.target.value) })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el pago con folio {deletingPayment?.folio}.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
