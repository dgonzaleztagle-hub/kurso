import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateForDB, formatDateForDisplay, parseDateFromDB } from "@/lib/dateUtils";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { paymentNotificationSchema } from '@/lib/validationSchemas';
import { Loader2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHILEAN_BANKS = [
  'Banco de Chile',
  'Banco Santander',
  'Banco del Estado de Chile',
  'Banco BCI',
  'Scotiabank',
  'Banco Itaú',
  'Banco Security',
  'Banco Falabella',
  'Banco Ripley',
  'Banco Consorcio',
  'BICE',
  'Banco Internacional',
  'Coopeuch',
  'Otro (escribir manualmente)'
];

interface DebtItem {
  type: 'activity' | 'monthly_fee';
  id?: number;
  name: string;
  amount: number;
  months?: string[];
}

export default function PaymentPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Form state
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [amount, setAmount] = useState('');
  const [payerName, setPayerName] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [customBank, setCustomBank] = useState('');
  const [selectedDebts, setSelectedDebts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStudentData();
  }, [user]);

  const loadStudentData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Obtener estudiante vinculado
      const { data: studentLink } = await supabase
        .from('user_students')
        .select('student_id, students(*)')
        .eq('user_id', user.id)
        .single();

      if (!studentLink) {
        toast({
          title: 'Error',
          description: 'No hay estudiante vinculado a esta cuenta',
          variant: 'destructive',
        });
        return;
      }

      setStudent(studentLink.students);

      // Cargar deudas
      await loadDebts(studentLink.student_id);

      // Cargar historial de pagos
      await loadPaymentHistory(studentLink.student_id);

      // Cargar notificaciones
      await loadNotifications();
    } catch (error) {
      console.error('Error loading student data:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar datos del estudiante',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDebts = async (studentId: number) => {
    const debtsData: DebtItem[] = [];

    // Calcular deuda de cuotas mensuales
    const monthlyFeeDebt = await calculateMonthlyFeeDebt(studentId);
    if (monthlyFeeDebt.amount > 0) {
      debtsData.push(monthlyFeeDebt);
    }

    // Calcular deudas de actividades
    const activityDebts = await calculateActivityDebts(studentId);
    debtsData.push(...activityDebts);

    setDebts(debtsData);
  };

  const calculateMonthlyFeeDebt = async (studentId: number) => {
    const MONTHLY_FEE = 3000;
    const TOTAL_ANNUAL_FEE = 30000;

    // Obtener pagos de cuotas mensuales
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('student_id', studentId)
      .ilike('concept', 'cuota%');

    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const remainingDebt = TOTAL_ANNUAL_FEE - totalPaid;

    const pendingMonths: string[] = [];
    if (remainingDebt > 0) {
      const months = ['Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const paidMonths = Math.floor(totalPaid / MONTHLY_FEE);
      const partialMonth = totalPaid % MONTHLY_FEE;

      for (let i = paidMonths; i < months.length; i++) {
        if (i === paidMonths && partialMonth > 0) {
          pendingMonths.push(`${months[i]} (parcial: $${MONTHLY_FEE - partialMonth})`);
        } else {
          pendingMonths.push(months[i]);
        }
      }
    }

    return {
      type: 'monthly_fee' as const,
      name: 'Cuotas Mensuales',
      amount: remainingDebt,
      months: pendingMonths,
    };
  };

  const calculateActivityDebts = async (studentId: number) => {
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .order('activity_date', { ascending: true });

    if (!activities) return [];

    const { data: student } = await supabase
      .from('students')
      .select('enrollment_date')
      .eq('id', studentId)
      .single();

    if (!student) return [];

    const enrollmentDate = parseDateFromDB(student.enrollment_date);

    const { data: exclusions } = await supabase
      .from('activity_exclusions')
      .select('activity_id')
      .eq('student_id', studentId);

    const excludedActivityIds = new Set(exclusions?.map(e => e.activity_id) || []);

    // Obtener todos los pagos del estudiante para verificar actividades pagadas
    const { data: allPayments } = await supabase
      .from('payments')
      .select('activity_id, amount, concept')
      .eq('student_id', studentId);

    const paidActivities = new Map<number, number>();
    
    for (const activity of activities) {
      // Sumar todos los pagos relacionados con esta actividad
      const relatedPayments = allPayments?.filter(p => {
        // Primero verificar si está vinculado directamente por activity_id
        if (p.activity_id !== null && p.activity_id === activity.id) {
          return true;
        }
        
        // Si no tiene activity_id, verificar por concepto
        // Normalizar ambos strings para comparación
        const activityNameNormalized = activity.name.toUpperCase().trim().replace(/\s+/g, ' ');
        const conceptNormalized = (p.concept || '').toUpperCase().trim().replace(/\s+/g, ' ');
        
        // El concepto debe contener el nombre completo de la actividad
        return conceptNormalized.includes(activityNameNormalized);
      }) || [];
      
      const totalPaid = relatedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      paidActivities.set(activity.id, totalPaid);
    }

    const debts: DebtItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const activity of activities) {
      // Solo considerar actividades con fecha
      if (!activity.activity_date) continue;
      
      const activityDate = new Date(activity.activity_date);
      
      // Solo considerar actividades que ya pasaron
      if (activityDate > today) continue;
      
      // Excluir si el alumno está excluido de esta actividad
      if (excludedActivityIds.has(activity.id)) continue;
      
      // Excluir si el alumno se matriculó después de la actividad
      if (enrollmentDate > activityDate) continue;

      const paid = paidActivities.get(activity.id) || 0;
      const owed = Number(activity.amount) - paid;

      if (owed > 0) {
        debts.push({
          type: 'activity',
          id: activity.id,
          name: activity.name,
          amount: owed,
        });
      }
    }

    return debts;
  };

  const loadPaymentHistory = async (studentId: number) => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false });

    setPaymentHistory(data || []);
  };

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('payment_notifications')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    setNotifications(data || []);
  };

  const toggleDebtSelection = (debtKey: string) => {
    const newSelection = new Set(selectedDebts);
    if (newSelection.has(debtKey)) {
      newSelection.delete(debtKey);
    } else {
      newSelection.add(debtKey);
    }
    setSelectedDebts(newSelection);
  };

  const calculateTotalSelected = () => {
    let total = 0;
    selectedDebts.forEach(key => {
      const debt = debts.find(d => getDebtKey(d) === key);
      if (debt) total += debt.amount;
    });
    return total;
  };

  const getDebtKey = (debt: DebtItem) => {
    return debt.type === 'activity' ? `activity_${debt.id}` : 'monthly_fee';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!student || !paymentDate || !amount || !payerName) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos obligatorios',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedBank) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un banco',
        variant: 'destructive',
      });
      return;
    }

    const bank = selectedBank === 'Otro (escribir manualmente)' ? customBank : selectedBank;
    if (!bank || bank.trim() === '') {
      toast({
        title: 'Error',
        description: 'Por favor ingresa el nombre del banco',
        variant: 'destructive',
      });
      return;
    }

    if (selectedDebts.size === 0) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona al menos una deuda a pagar',
        variant: 'destructive',
      });
      return;
    }

    const paymentAmount = Number(amount);
    const totalSelected = calculateTotalSelected();

    // Distribuir el pago priorizando actividades sobre cuotas mensuales
    let remainingPayment = paymentAmount;
    
    // Separar actividades y cuotas mensuales de las deudas seleccionadas
    const selectedDebtsData = Array.from(selectedDebts)
      .map(key => debts.find(d => getDebtKey(d) === key))
      .filter(Boolean);
    
    const activities = selectedDebtsData.filter(d => d!.type === 'activity');
    const monthlyFees = selectedDebtsData.filter(d => d!.type === 'monthly_fee');
    
    // PRIMERO: Pagar actividades completas en orden
    const selectedDebtsArray: any[] = [];
    
    for (const activity of activities) {
      if (!activity || remainingPayment <= 0) continue;
      
      const paidAmount = Math.min(remainingPayment, activity.amount);
      remainingPayment -= paidAmount;
      
      selectedDebtsArray.push({
        type: activity.type,
        id: activity.id,
        name: activity.name,
        amount: activity.amount,
        paid_amount: paidAmount,
      });
    }
    
    // SEGUNDO: Si queda dinero, aplicar a cuotas mensuales
    if (remainingPayment > 0) {
      // Si hay cuotas mensuales seleccionadas, aplicar a ellas primero
      for (const monthlyFee of monthlyFees) {
        if (!monthlyFee || remainingPayment <= 0) continue;
        
        const paidAmount = Math.min(remainingPayment, monthlyFee.amount);
        remainingPayment -= paidAmount;
        
        selectedDebtsArray.push({
          type: monthlyFee.type,
          id: monthlyFee.id,
          name: monthlyFee.name,
          amount: monthlyFee.amount,
          paid_amount: paidAmount,
        });
      }
      
      // Si aún queda dinero después de procesar las cuotas seleccionadas,
      // agregar como abono a cuota mensual general
      if (remainingPayment > 0) {
        selectedDebtsArray.push({
          type: 'monthly_fee',
          id: null,
          name: 'Cuotas Mensuales',
          amount: remainingPayment,
          paid_amount: remainingPayment,
        });
        remainingPayment = 0;
      }
    }

    const paymentDetails = {
      selected_debts: selectedDebtsArray,
      remainder_to_monthly_fees: remainingPayment > 0 ? remainingPayment : 0,
    };

    console.log('=== PAYMENT DISTRIBUTION DEBUG ===');
    console.log('Payment amount:', paymentAmount);
    console.log('Selected debts array:', JSON.stringify(selectedDebtsArray, null, 2));
    console.log('Remainder:', remainingPayment);

    try {
      setSubmitting(true);

      console.log('=== PAYMENT NOTIFICATION DEBUG ===');
      console.log('User ID:', user?.id);
      console.log('Student ID:', student.id);
      console.log('Payment Date:', paymentDate);
      console.log('Amount:', paymentAmount);
      console.log('Payer Name:', payerName);
      console.log('Bank:', bank);
      console.log('Payment Details:', paymentDetails);

      // Validate payment notification data
      const validationResult = paymentNotificationSchema.safeParse({
        payer_name: payerName,
        bank,
        payment_date: paymentDate ? formatDateForDB(paymentDate) : '',
        amount: paymentAmount,
        payment_details: paymentDetails,
      });

      if (!validationResult.success) {
        const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error('Validation errors:', errorMessage);
        toast({
          title: 'Error de validación',
          description: errorMessage,
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      console.log('Validation passed, inserting into database...');

      const insertData = {
        user_id: user!.id,
        student_id: student.id,
        payment_date: format(paymentDate, 'yyyy-MM-dd'),
        amount: paymentAmount,
        payer_name: payerName,
        bank,
        payment_details: paymentDetails,
        reference: `REF-${Date.now()}`,
      };

      console.log('Insert data:', insertData);

      const { data, error } = await supabase
        .from('payment_notifications')
        .insert(insertData)
        .select();

      if (error) {
        console.error('=== DATABASE ERROR ===');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        
        const errorMessage = error.message || error.details || error.hint || 'Ocurrió un error al procesar su solicitud';
        toast({
          title: 'Error al informar el pago',
          description: errorMessage,
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      console.log('Payment notification inserted successfully:', data);

      toast({
        title: 'Pago informado correctamente',
        description: 'Su pago será revisado por el administrador. Recibirá una notificación una vez sea aprobado.',
        duration: 5000,
      });

      // Reset form
      setPaymentDate(undefined);
      setAmount('');
      setPayerName('');
      setSelectedBank('');
      setCustomBank('');
      setSelectedDebts(new Set());

      // Reload data - important to reload debts so user can report another payment
      if (student) {
        await loadDebts(student.id);
        await loadPaymentHistory(student.id);
      }
      loadNotifications();
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      const errorMessage = error?.message || error?.details || 'Error desconocido al informar el pago';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No hay estudiante vinculado</CardTitle>
            <CardDescription>
              Esta cuenta no tiene un estudiante vinculado. Por favor contacta al administrador.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Portal de Pagos</h1>
        <p className="text-muted-foreground">Estudiante: {student.name}</p>
      </div>

      {/* Resumen de deudas */}
      <Card>
        <CardHeader>
          <CardTitle>Deudas Pendientes</CardTitle>
          <CardDescription>
            Total adeudado: ${debts.reduce((sum, d) => sum + d.amount, 0).toLocaleString('es-CL')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {debts.length === 0 ? (
            <p className="text-muted-foreground">No hay deudas pendientes</p>
          ) : (
            debts.map(debt => (
              <div key={getDebtKey(debt)} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{debt.name}</h3>
                    {debt.months && debt.months.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Meses pendientes: {debt.months.join(', ')}
                      </p>
                    )}
                    <p className="text-lg font-bold mt-2">
                      ${debt.amount.toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Formulario para informar pago */}
      <Card>
        <CardHeader>
          <CardTitle>Informar Pago</CardTitle>
          <CardDescription>
            Complete los datos del pago realizado y seleccione qué deudas está cubriendo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha del Pago *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paymentDate ? format(paymentDate, "dd 'de' MMMM, yyyy", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={setPaymentDate}
                      disabled={(date) => date > new Date() || date < new Date("2024-01-01")}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Monto del Pago *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payer-name">Nombre de quien realizó la transferencia *</Label>
                <Input
                  id="payer-name"
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank">Banco *</Label>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger id="bank">
                    <SelectValue placeholder="Seleccione un banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHILEAN_BANKS.map(bank => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBank === 'Otro (escribir manualmente)' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="custom-bank">Escriba el nombre del banco</Label>
                  <Input
                    id="custom-bank"
                    type="text"
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {/* Selección de deudas a pagar */}
            {debts.length > 0 && (
              <div className="space-y-4">
                <div>
                  <Label>Seleccione qué deudas está cubriendo con este pago</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Puede seleccionar una o más deudas. Si el monto no alcanza a cubrir el total, se considerará como un abono parcial. Los remanentes se aplicarán automáticamente a las cuotas mensuales pendientes.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  {debts.map(debt => (
                    <div key={getDebtKey(debt)} className="flex items-center space-x-2">
                      <Checkbox
                        id={getDebtKey(debt)}
                        checked={selectedDebts.has(getDebtKey(debt))}
                        onCheckedChange={() => toggleDebtSelection(getDebtKey(debt))}
                      />
                      <Label
                        htmlFor={getDebtKey(debt)}
                        className="flex-1 cursor-pointer"
                      >
                        {debt.name} - ${debt.amount.toLocaleString('es-CL')}
                      </Label>
                    </div>
                  ))}
                </div>

                {amount && (
                  <div className="bg-muted p-4 rounded-lg space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Monto del pago:</span> ${Number(amount).toLocaleString('es-CL')}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Total seleccionado:</span> ${calculateTotalSelected().toLocaleString('es-CL')}
                    </p>
                    {Number(amount) < calculateTotalSelected() && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ El monto ingresado es menor al total seleccionado. Se registrará como abono parcial.
                      </p>
                    )}
                    {Number(amount) > calculateTotalSelected() && (
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        ℹ️ Remanente de ${(Number(amount) - calculateTotalSelected()).toLocaleString('es-CL')} se aplicará a cuotas mensuales pendientes.
                      </p>
                    )}
                    {Number(amount) === calculateTotalSelected() && calculateTotalSelected() > 0 && (
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        ✓ El monto coincide exactamente con las deudas seleccionadas.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={submitting || !paymentDate || !amount || !payerName || !selectedBank || selectedDebts.size === 0} 
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Informando pago...
                </>
              ) : (
                'Informar Pago'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notificaciones de pagos informados */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pagos Informados</CardTitle>
            <CardDescription>Estado de los pagos que has informado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`border rounded-lg p-4 ${
                    notification.status === 'approved'
                      ? 'bg-green-50 dark:bg-green-950'
                      : notification.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-950'
                      : 'bg-yellow-50 dark:bg-yellow-950'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">
                        ${Number(notification.amount).toLocaleString('es-CL')} -{' '}
                        {formatDateForDisplay(notification.payment_date)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Informado el {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        notification.status === 'approved'
                          ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                          : notification.status === 'rejected'
                          ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                          : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                      }`}
                    >
                      {notification.status === 'approved'
                        ? 'Aprobado'
                        : notification.status === 'rejected'
                        ? 'Rechazado'
                        : 'Pendiente'}
                    </span>
                  </div>
                  {notification.rejection_reason && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      Motivo: {notification.rejection_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de pagos aprobados */}
      {paymentHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de Pagos</CardTitle>
            <CardDescription>Pagos registrados y aprobados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paymentHistory.map(payment => (
                <div key={payment.id} className="flex justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{payment.concept}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateForDisplay(payment.payment_date)}
                    </p>
                  </div>
                  <p className="font-semibold">
                    ${Number(payment.amount).toLocaleString('es-CL')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
