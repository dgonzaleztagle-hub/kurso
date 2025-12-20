import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeftRight, Search, Calendar, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateFromDB, formatDateForDisplay, formatDateForDB } from "@/lib/dateUtils";
import { generateTransferReceipt } from "@/lib/receiptGenerator";

interface CreditMovement {
  id: string;
  student_id: number;
  type: 'payment_redirect' | 'manual_adjustment' | 'payment_deduction' | 'activity_refund';
  amount: number;
  description: string;
  created_at: string;
  created_by: string;
  source_payment_id: number | null;
  details?: Array<{ concept: string; amount: number }>;
  student_name?: string;
  creator_name?: string;
}

export default function CreditMovements() {
  const [movements, setMovements] = useState<CreditMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<CreditMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadMovements();
  }, []);

  useEffect(() => {
    filterMovements();
  }, [movements, searchTerm, dateFrom, dateTo]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      
      // Fetch movements with student info
      const { data: movementsData, error: movementsError } = await supabase
        .from("credit_movements")
        .select(`
          *,
          students!credit_movements_student_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;

      // Get unique creator IDs
      const creatorIds = [...new Set(movementsData?.map(m => m.created_by).filter(Boolean))];
      
      // Fetch creator names
      const { data: creatorsData } = await supabase
        .from("user_roles")
        .select("user_id, user_name")
        .in("user_id", creatorIds);

      const creatorsMap = new Map(
        creatorsData?.map(c => [c.user_id, c.user_name]) || []
      );

      const enrichedMovements: CreditMovement[] = movementsData?.map(m => ({
        ...m,
        student_name: m.students?.name,
        creator_name: creatorsMap.get(m.created_by) || 'Sistema',
        details: Array.isArray(m.details) ? m.details as Array<{ concept: string; amount: number }> : []
      })) || [];

      setMovements(enrichedMovements);
    } catch (error) {
      console.error("Error loading movements:", error);
      toast.error("Error al cargar movimientos de crédito");
    } finally {
      setLoading(false);
    }
  };

  const filterMovements = () => {
    let filtered = [...movements];

    // Filter by search term (student name or description)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.student_name?.toLowerCase().includes(term) ||
        m.description.toLowerCase().includes(term)
      );
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(m => 
        new Date(m.created_at) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      filtered = filtered.filter(m => 
        new Date(m.created_at) <= new Date(dateTo + 'T23:59:59')
      );
    }

    setFilteredMovements(filtered);
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      'payment_redirect': 'Traspaso de Pago',
      'manual_adjustment': 'Ajuste Manual',
      'payment_deduction': 'Deducción de Pago',
      'activity_refund': 'Devolución de Actividad'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      'payment_redirect': 'default',
      'manual_adjustment': 'secondary',
      'payment_deduction': 'outline',
      'activity_refund': 'outline'
    };
    return colors[type as keyof typeof colors] || 'default';
  };

  const totalPositive = filteredMovements
    .filter(m => m.amount > 0)
    .reduce((sum, m) => sum + Number(m.amount), 0);

  const totalNegative = filteredMovements
    .filter(m => m.amount < 0)
    .reduce((sum, m) => sum + Math.abs(Number(m.amount)), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleViewCertificate = async (movement: CreditMovement) => {
    try {
      // Fetch student info
      const { data: studentData } = await supabase
        .from("students")
        .select("name")
        .eq("id", movement.student_id)
        .single();

      // Fetch original payment info
      const { data: paymentData } = await supabase
        .from("payments")
        .select("concept")
        .eq("id", movement.source_payment_id)
        .maybeSingle();

      const details = movement.details || [];
      const isCredit = movement.amount > 0;

      await generateTransferReceipt({
        studentId: movement.student_id,
        studentName: studentData?.name || `Estudiante ${movement.student_id}`,
        transferDate: movement.created_at.split('T')[0],
        amount: Math.abs(movement.amount),
        originalConcept: paymentData?.concept || movement.description,
        redirectType: isCredit ? 'credit' : 'debts',
        details: details.length > 0 ? details : undefined,
        remainingCredit: isCredit ? movement.amount : undefined,
      });

      toast.success("Certificado generado");
    } catch (error) {
      console.error("Error generating certificate:", error);
      toast.error("Error al generar certificado");
    }
  };

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold mb-1">Movimientos de Crédito</h1>
        <p className="text-sm text-muted-foreground">
          Historial de traspasos y ajustes de créditos
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-3 w-3 sm:h-4 sm:w-4" />
              Total Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold">{filteredMovements.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
              Créditos Generados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-green-600">
              {formatCurrency(totalPositive)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
              Créditos Aplicados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-red-600">
              {formatCurrency(totalNegative)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-3 sm:space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search" className="text-xs sm:text-sm">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Alumno o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom" className="text-xs sm:text-sm">Desde</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo" className="text-xs sm:text-sm">Hasta</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>
          </div>

          {(searchTerm || dateFrom || dateTo) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs sm:text-sm"
            >
              Limpiar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-base">Historial de Movimientos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay movimientos registrados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs sm:text-sm">
                    <TableHead className="px-2 sm:px-4">Fecha</TableHead>
                    <TableHead className="px-2 sm:px-4">Alumno</TableHead>
                    <TableHead className="px-2 sm:px-4">Tipo</TableHead>
                    <TableHead className="px-2 sm:px-4">Descripción</TableHead>
                    <TableHead className="px-2 sm:px-4 text-right">Monto</TableHead>
                    <TableHead className="px-2 sm:px-4">Creado por</TableHead>
                    <TableHead className="px-2 sm:px-4 text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement.id} className="text-xs sm:text-sm">
                      <TableCell className="px-2 sm:px-4 whitespace-nowrap">
                        {formatDateForDisplay(movement.created_at.split('T')[0])}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">{movement.student_name}</TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <Badge variant={getTypeColor(movement.type) as any} className="text-xs">
                          {getTypeLabel(movement.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 max-w-[200px] truncate">
                        {movement.description}
                      </TableCell>
                      <TableCell className={`px-2 sm:px-4 text-right font-medium ${
                        movement.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {movement.amount > 0 ? '+' : ''}{formatCurrency(movement.amount)}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">{movement.creator_name}</TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewCertificate(movement)}
                          className="text-xs"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Ver Certificado
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
