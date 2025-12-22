import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateForDisplay } from "@/lib/dateUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';

interface PaymentNotification {
  id: string;
  user_id: string;
  student_id: number;
  payment_date: string;
  amount: number;
  payer_name: string;
  bank: string;
  payment_details: any;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
  students?: {
    id: number;
    first_name: string;
    last_name: string;
  };
}

export default function PaymentNotifications() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<PaymentNotification | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Helper function to safely format dates from date fields (YYYY-MM-DD)
  const formatDateSafe = (dateStr: string): string => {
    return formatDateForDisplay(dateStr);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_notifications')
        .select(`
          *,
          students (
            id,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications((data || []) as unknown as PaymentNotification[]);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar las notificaciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStudentName = (notification: PaymentNotification) => {
    if (!notification.students) return 'Estudiante desconocido';
    return `${notification.students.first_name || ''} ${notification.students.last_name || ''}`.trim() || 'Sin Nombre';
  };

  const handleViewDetails = (notification: PaymentNotification) => {
    setSelectedNotification(notification);
    setShowDetailsDialog(true);
  };

  const handleApprove = async (notification: PaymentNotification) => {
    if (userRole !== 'master') {
      toast({
        title: 'Acceso denegado',
        description: 'Solo master puede aprobar pagos',
        variant: 'destructive',
      });
      return;
    }

    setSelectedNotification(notification);
    setProcessing(true);

    try {
      // Actualizar estado de la notificación
      const { error: updateError } = await supabase
        .from('payment_notifications')
        .update({
          status: 'approved',
          processed_by: user!.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', notification.id);

      if (updateError) throw updateError;

      // Registrar los pagos en la tabla payments
      const paymentDetails = notification.payment_details;
      const selectedDebts = paymentDetails.selected_debts || [];
      const remainder = paymentDetails.remainder_to_monthly_fees || 0;
      const studentFullName = getStudentName(notification);

      console.log('=== APPROVAL DEBUG ===');
      console.log('Payment details:', JSON.stringify(paymentDetails, null, 2));
      console.log('Selected debts to process:', selectedDebts.length);

      // Obtener el siguiente folio
      const { data: folioData } = await supabase.rpc('get_next_payment_folio');
      let currentFolio = folioData || 1;

      // Registrar pagos según la distribución
      for (const debt of selectedDebts) {
        console.log('Processing debt:', debt.type, debt.name, 'Amount:', debt.paid_amount);

        if (debt.type === 'activity') {
          // Registrar solo el monto pagado para actividades
          const { error: insertError } = await supabase.from('payments').insert({
            folio: currentFolio++,
            payment_date: notification.payment_date,
            student_id: notification.student_id,
            student_name: studentFullName,
            activity_id: debt.id,
            concept: debt.name,
            amount: debt.paid_amount, // Usar el monto realmente pagado
          });
          if (insertError) console.error('Error inserting activity payment:', insertError);
        } else if (debt.type === 'monthly_fee') {
          // Registrar cuotas mensuales
          const { error: insertError } = await supabase.from('payments').insert({
            folio: currentFolio++,
            payment_date: notification.payment_date,
            student_id: notification.student_id,
            student_name: studentFullName,
            concept: 'Cuota Mensual',
            amount: debt.paid_amount, // Usar el monto realmente pagado
          });
          if (insertError) console.error('Error inserting monthly fee payment:', insertError);
        }
      }

      toast({
        title: 'Pago aprobado',
        description: 'El pago ha sido aprobado y registrado correctamente',
      });

      loadNotifications();
      setShowDetailsDialog(false);
    } catch (error) {
      console.error('Error approving payment:', error);
      toast({
        title: 'Error',
        description: 'Error al aprobar el pago',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setSelectedNotification(null);
    }
  };

  const handleReject = () => {
    setShowRejectDialog(true);
    setShowDetailsDialog(false);
  };

  const confirmReject = async () => {
    if (userRole !== 'master') {
      toast({
        title: 'Acceso denegado',
        description: 'Solo master puede rechazar pagos',
        variant: 'destructive',
      });
      return;
    }

    if (!rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Debe indicar el motivo del rechazo',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      const { error } = await supabase
        .from('payment_notifications')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          processed_by: user!.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedNotification!.id);

      if (error) throw error;

      toast({
        title: 'Pago rechazado',
        description: 'El pago ha sido rechazado',
      });

      loadNotifications();
      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedNotification(null);
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast({
        title: 'Error',
        description: 'Error al rechazar el pago',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Aprobado</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rechazado</Badge>;
      default:
        return <Badge className="bg-yellow-500">Pendiente</Badge>;
    }
  };

  const pendingCount = notifications.filter(n => n.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notificaciones de Pago</h1>
        <p className="text-muted-foreground">
          {pendingCount > 0 ? `${pendingCount} pago${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de revisión` : 'No hay pagos pendientes'}
        </p>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay notificaciones</CardTitle>
            <CardDescription>
              No se han informado pagos aún
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map(notification => (
            <Card key={notification.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {getStudentName(notification)}
                      {getStatusBadge(notification.status)}
                    </CardTitle>
                    <CardDescription>
                      Informado el {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      ${Number(notification.amount).toLocaleString('es-CL')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateSafe(notification.payment_date)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Pagador:</span> {notification.payer_name}
                    </div>
                    <div>
                      <span className="font-medium">Banco:</span> {notification.bank}
                    </div>
                  </div>

                  {notification.rejection_reason && (
                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-2">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Motivo de rechazo:
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {notification.rejection_reason}
                      </p>
                    </div>
                  )}

                  {notification.processed_at && (
                    <p className="text-xs text-muted-foreground">
                      Procesado el {format(new Date(notification.processed_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(notification)}
                  >
                    <Eye className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Ver Detalles</span>
                    <span className="sm:hidden">Ver</span>
                  </Button>

                  {notification.status === 'pending' && userRole === 'master' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApprove(notification)}
                        disabled={processing}
                      >
                        <CheckCircle className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Aprobar</span>
                        <span className="sm:hidden">Ok</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedNotification(notification);
                          handleReject();
                        }}
                        disabled={processing}
                      >
                        <XCircle className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Rechazar</span>
                        <span className="sm:hidden">No</span>
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de detalles */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Pago</DialogTitle>
            <DialogDescription>
              Información completa del pago informado
            </DialogDescription>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Estudiante</Label>
                  <p className="font-medium">{getStudentName(selectedNotification)}</p>
                </div>
                <div>
                  <Label>Monto</Label>
                  <p className="font-medium text-lg">
                    ${Number(selectedNotification.amount).toLocaleString('es-CL')}
                  </p>
                </div>
                <div>
                  <Label>Fecha del Pago</Label>
                  <p>{formatDateSafe(selectedNotification.payment_date)}</p>
                </div>
                <div>
                  <Label>Pagador</Label>
                  <p>{selectedNotification.payer_name}</p>
                </div>
                <div>
                  <Label>Banco</Label>
                  <p>{selectedNotification.bank}</p>
                </div>
                <div>
                  <Label>Estado</Label>
                  <div>{getStatusBadge(selectedNotification.status)}</div>
                </div>
              </div>

              <div>
                <Label>Distribución del Pago</Label>
                <div className="border rounded-lg p-4 mt-2 space-y-2">
                  {selectedNotification.payment_details?.selected_debts?.length > 0 ? (
                    <>
                      <p className="text-sm font-medium">Deudas seleccionadas:</p>
                      {selectedNotification.payment_details.selected_debts.map((debt: any, index: number) => {
                        const paidAmount = debt.paid_amount || debt.amount;
                        const isPartial = debt.paid_amount && debt.paid_amount < debt.amount;

                        return (
                          <div key={index} className="flex justify-between text-sm">
                            <span>
                              {debt.name}
                              {isPartial && (
                                <span className="text-amber-600 dark:text-amber-400 ml-2">(Abono parcial)</span>
                              )}
                            </span>
                            <span className="font-medium">
                              ${Math.round(paidAmount).toLocaleString('es-CL')}
                              {isPartial && (
                                <span className="text-muted-foreground ml-2">
                                  de ${Math.round(debt.amount).toLocaleString('es-CL')}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay deudas específicas seleccionadas</p>
                  )}

                  {selectedNotification.payment_details?.remainder_to_monthly_fees > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Remanente a Cuotas Mensuales:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          ${Number(selectedNotification.payment_details.remainder_to_monthly_fees).toLocaleString('es-CL')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Cerrar
            </Button>
            {selectedNotification?.status === 'pending' && userRole === 'master' && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processing}
                >
                  Rechazar
                </Button>
                <Button
                  onClick={() => handleApprove(selectedNotification)}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Aprobar'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rechazo */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Pago</DialogTitle>
            <DialogDescription>
              Indique el motivo del rechazo. El apoderado recibirá esta información.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Motivo del rechazo *</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ej: El comprobante no es legible, la fecha no coincide, etc."
                rows={4}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason('');
                setShowDetailsDialog(true);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={processing || !rejectionReason.trim()}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rechazando...
                </>
              ) : (
                'Confirmar Rechazo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
