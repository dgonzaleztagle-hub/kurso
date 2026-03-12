import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { BankCombobox } from "@/components/BankCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CHILEAN_ACCOUNT_TYPES } from "@/lib/banking";
import { toast } from "sonner";
import { FileText, Download, CheckCircle, XCircle, Clock, Check, X, Share2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
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

interface Reimbursement {
  id: string;
  created_at: string;
  amount: number;
  subject: string;
  account_info: ReimbursementAccountInfo | null;
  status: 'pending' | 'approved' | 'rejected';
  attachments: StoredReimbursementFile[] | null;
  rejection_reason?: string | null;
  user_id: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  folio?: number | null;
  type: 'reimbursement' | 'supplier_payment';
  supplier_name?: string | null;
  payment_proof?: StoredReimbursementFile[] | StoredReimbursementFile | null;
  expense_folio?: number | null;
}

interface ReimbursementWithUser extends Reimbursement {
  user_display_name?: string;
  user_email?: string;
}

type ReimbursementFile = {
  name: string;
  path: string;
  uploaded_at?: string;
};

type StoredReimbursementFile = ReimbursementFile | string;

type ReimbursementAccountInfo = {
  bank?: string;
  account_type?: string;
  account_number?: string;
  holder_name?: string;
  supplier_rut?: string;
  supplier_email?: string;
  supplier_phone?: string;
};

type ReimbursementInsert = TablesInsert<"reimbursements">;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

const getFileNameFromPath = (path: string) => path.split('/').pop() || 'archivo';

const normalizeStoredFile = (file: StoredReimbursementFile): ReimbursementFile | null => {
  if (typeof file === 'string') {
    return {
      name: getFileNameFromPath(file),
      path: file,
      uploaded_at: undefined,
    };
  }

  if (file && typeof file.name === 'string' && typeof file.path === 'string') {
    return file;
  }

  return null;
};

const normalizeStoredFiles = (files: StoredReimbursementFile[] | null | undefined) =>
  (files ?? [])
    .map(normalizeStoredFile)
    .filter((file): file is ReimbursementFile => file !== null);

export default function Reimbursements() {
  const { user, userRole } = useAuth();
  const { roleInCurrentTenant, currentTenant } = useTenant();
  const isMobile = useIsMobile();
  const [reimbursements, setReimbursements] = useState<ReimbursementWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedReimbursement, setSelectedReimbursement] = useState<ReimbursementWithUser | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [uploadingProof, setUploadingProof] = useState(false);

  // Form state
  const [type, setType] = useState<'reimbursement' | 'supplier_payment'>('reimbursement');
  const [amount, setAmount] = useState("");
  const [subject, setSubject] = useState("");
  const [bank, setBank] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierRut, setSupplierRut] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const effectiveRole = roleInCurrentTenant || userRole;
  const canProcessReimbursements = ['master', 'owner', 'admin'].includes(effectiveRole || '');

  const fetchReimbursements = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const { data: reimbursementsData, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((reimbursementsData ?? []).map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
      let rolesData: { user_id: string; user_name: string | null }[] | null = null;

      if (userIds.length > 0) {
        const rolesResult = await supabase
          .from('user_roles')
          .select('user_id, user_name')
          .in('user_id', userIds);

        if (rolesResult.error) {
          console.error('Error fetching roles:', rolesResult.error);
        } else {
          rolesData = rolesResult.data;
        }
      }

      const reimbursementsWithUsers = (reimbursementsData || []).map((reimbursement) => {
        const userRole = reimbursement.user_id
          ? rolesData?.find((row) => row.user_id === reimbursement.user_id)
          : null;
        const displayName = reimbursement.user_id
          ? (userRole?.user_name || 'Usuario desconocido')
          : 'Proveedor externo';
        return {
          ...reimbursement,
          status: reimbursement.status as Reimbursement['status'],
          type: reimbursement.type as Reimbursement['type'],
          user_display_name: displayName,
        };
      });

      setReimbursements(reimbursementsWithUsers);
    } catch (error: unknown) {
      console.error('Error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    if (currentTenant?.id) {
      void fetchReimbursements();
    }
  }, [currentTenant?.id, fetchReimbursements]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (reimbursementId: string): Promise<ReimbursementFile[]> => {
    if (files.length === 0) return [];

    const uploadedFiles: ReimbursementFile[] = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${reimbursementId}/${Math.random()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('reimbursements')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      uploadedFiles.push({
        name: file.name,
        path: fileName,
      });
    }

    return uploadedFiles;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;
    const resolvedTenantId = currentTenant?.id || localStorage.getItem("kurso_last_tenant");
    if (!resolvedTenantId) {
      toast.error("No se pudo detectar el curso activo");
      return;
    }

    const hasBankData = bank && accountType && accountNumber && holderName;
    const hasSupplierData = type === "supplier_payment" ? supplierName && supplierRut : true;

    if (!amount || !subject || !hasBankData || !hasSupplierData) {
      toast.error("Complete todos los campos requeridos antes de continuar");
      return;
    }

    setUploading(true);

    try {
      const { data: folioData } = await supabase.rpc('get_next_reimbursement_folio_for_tenant', {
        target_tenant_id: resolvedTenantId,
      });

      const accountInfo: ReimbursementAccountInfo = {
        bank,
        account_type: accountType,
        account_number: accountNumber,
        holder_name: holderName,
      };

      const reimbursementData: ReimbursementInsert = {
        tenant_id: resolvedTenantId,
        amount: parseFloat(amount),
        subject,
        account_info: accountInfo as Json,
        attachments: [],
        status: 'pending',
        user_id: user.id,
        type,
        supplier_name: type === 'supplier_payment' ? supplierName : undefined,
        folio: folioData,
      };

      // Agregar RUT del proveedor en account_info si es pago a proveedor
      if (type === 'supplier_payment' && supplierRut) {
        reimbursementData.account_info = {
          ...accountInfo,
          supplier_rut: supplierRut,
        } as Json;
      }

      const { data, error: insertError } = await supabase
        .from('reimbursements')
        .insert(reimbursementData)
        .select()
        .single();

      if (insertError) throw insertError;

      if (files.length > 0) {
        const uploadedFiles = await uploadFiles(data.id);

        const { error: updateError } = await supabase
          .from('reimbursements')
          .update({ attachments: uploadedFiles })
          .eq('tenant_id', resolvedTenantId)
          .eq('id', data.id);

        if (updateError) throw updateError;
      }

      toast.success(type === 'supplier_payment' ? "Pago a proveedor creado exitosamente" : "Rendición creada exitosamente");
      setOpen(false);
      resetForm();
      void fetchReimbursements();
    } catch (error: unknown) {
      console.error('Error:', error);
      toast.error(`Error al crear: ${getErrorMessage(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setAmount("");
    setSubject("");
    setBank("");
    setAccountType("");
    setAccountNumber("");
    setHolderName("");
    setSupplierName("");
    setSupplierRut("");
    setFiles([]);
    setProofFiles([]);
  };

  const uploadProofs = async (reimbursementId: string): Promise<ReimbursementFile[]> => {
    if (proofFiles.length === 0) return [];

    const uploadedProofs: ReimbursementFile[] = [];

    for (const file of proofFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${reimbursementId}/proof_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('reimbursements')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      uploadedProofs.push({
        name: file.name,
        path: fileName,
        uploaded_at: new Date().toISOString(),
      });
    }

    return uploadedProofs;
  };

  const invokeReimbursementAction = async (
    action: 'approve' | 'reject' | 'reopen' | 'delete',
    payload?: { rejectionReason?: string; paymentProof?: ReimbursementFile[] },
  ) => {
    if (!selectedReimbursement) {
      throw new Error('No hay rendición seleccionada');
    }

    const { data, error } = await supabase.functions.invoke('manage-reimbursement', {
      body: {
        action,
        reimbursementId: selectedReimbursement.id,
        rejectionReason: payload?.rejectionReason,
        paymentProof: payload?.paymentProof ?? [],
      },
    });

    if (error) {
      throw error;
    }

    if (data?.error) {
      throw new Error(String(data.error));
    }
  };

  const handleApprove = async () => {
    if (!selectedReimbursement) return;
    if (!currentTenant?.id) {
      toast.error("No se pudo detectar el curso activo");
      return;
    }

    setUploadingProof(true);
    try {
      let paymentProofs: ReimbursementFile[] = [];

      if (proofFiles.length > 0) {
        paymentProofs = await uploadProofs(selectedReimbursement.id);
      }

      await invokeReimbursementAction('approve', {
        paymentProof: paymentProofs,
      });

      toast.success(selectedReimbursement.type === 'supplier_payment' ? "Pago aprobado" : "Rendición aprobada");
      setShowApproveDialog(false);
      setSelectedReimbursement(null);
      setProofFiles([]);
      void fetchReimbursements();
    } catch (error: unknown) {
      toast.error(`Error: ${getErrorMessage(error)}`);
    } finally {
      setUploadingProof(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReimbursement || !rejectionReason.trim()) {
      toast.error("Debe ingresar un motivo de rechazo");
      return;
    }
    if (!currentTenant?.id) {
      toast.error("No se pudo detectar el curso activo");
      return;
    }

    try {
      await invokeReimbursementAction('reject', {
        rejectionReason,
      });

      toast.success(selectedReimbursement.type === 'supplier_payment' ? "Pago rechazado" : "Rendición rechazada");
      setShowRejectDialog(false);
      setSelectedReimbursement(null);
      setRejectionReason("");
      void fetchReimbursements();
    } catch (error: unknown) {
      toast.error(`Error: ${getErrorMessage(error)}`);
    }
  };

  const handleReopen = async () => {
    if (!selectedReimbursement) return;
    if (!currentTenant?.id) {
      toast.error("No se pudo detectar el curso activo");
      return;
    }

    try {
      await invokeReimbursementAction('reopen');

      toast.success(selectedReimbursement.type === 'supplier_payment' ? "Pago reabierto" : "Rendición reabierta");
      setShowReopenDialog(false);
      setSelectedReimbursement(null);
      void fetchReimbursements();
    } catch (error: unknown) {
      toast.error(`Error: ${getErrorMessage(error)}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedReimbursement) return;
    if (!currentTenant?.id) {
      toast.error("No se pudo detectar el curso activo");
      return;
    }

    try {
      await invokeReimbursementAction('delete');

      const message = selectedReimbursement.expense_folio
        ? (selectedReimbursement.type === 'supplier_payment' ? "Pago y egreso eliminados exitosamente" : "Rendición y egreso eliminados exitosamente")
        : (selectedReimbursement.type === 'supplier_payment' ? "Pago eliminado exitosamente" : "Rendición eliminada exitosamente");

      toast.success(message);
      setShowDeleteDialog(false);
      setDetailsOpen(false);
      setSelectedReimbursement(null);
      void fetchReimbursements();
    } catch (error: unknown) {
      toast.error(`Error al eliminar: ${getErrorMessage(error)}`);
    }
  };

  const downloadFile = async (path: string, name: string) => {
    try {
      if (/^https?:\/\//i.test(path)) {
        window.open(path, '_blank', 'noopener,noreferrer');
        return;
      }

      const { data, error } = await supabase.storage
        .from('reimbursements')
        .download(path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error("Error al descargar el archivo");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Aprobada</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rechazada</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
    }
  };

  const ReimbursementCard = ({ reimbursement }: { reimbursement: ReimbursementWithUser }) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => {
        setSelectedReimbursement(reimbursement);
        setDetailsOpen(true);
      }}
    >
      <CardContent className="p-3">
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {reimbursement.type === 'supplier_payment' ? 'Pago' : 'Rend'} #{reimbursement.folio}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {reimbursement.user_display_name || 'Usuario desconocido'}
            </p>
          </div>
          {getStatusBadge(reimbursement.status)}
        </div>
        <p className="text-xs mb-1 line-clamp-2">{reimbursement.subject}</p>
        <div className="flex justify-between items-center">
          <p className="font-bold text-base">${reimbursement.amount.toLocaleString('es-CL')}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(reimbursement.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderReimbursementDetails = (reimbursement: ReimbursementWithUser) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Folio</Label>
          <p className="text-sm font-medium">#{reimbursement.folio}</p>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Estado</Label>
          <div className="mt-0.5">{getStatusBadge(reimbursement.status)}</div>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Monto</Label>
          <p className="text-sm font-bold">${reimbursement.amount.toLocaleString('es-CL')}</p>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Fecha</Label>
          <p className="text-sm">{new Date(reimbursement.created_at).toLocaleDateString('es-CL')}</p>
        </div>
        <div className="col-span-2">
          <Label className="text-xs font-semibold text-muted-foreground">Solicitado por</Label>
          <p className="text-sm">{reimbursement.user_display_name || 'Usuario desconocido'}</p>
        </div>
      </div>

      {reimbursement.type === 'supplier_payment' && reimbursement.supplier_name && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Proveedor</Label>
          <p className="text-sm mt-0.5">{reimbursement.supplier_name}</p>
          {reimbursement.account_info?.supplier_rut && (
            <p className="text-xs text-muted-foreground">RUT: {reimbursement.account_info.supplier_rut}</p>
          )}
          {reimbursement.account_info?.supplier_email && (
            <p className="text-xs text-muted-foreground">Email: {reimbursement.account_info.supplier_email}</p>
          )}
          {reimbursement.account_info?.supplier_phone && (
            <p className="text-xs text-muted-foreground">Teléfono: {reimbursement.account_info.supplier_phone}</p>
          )}
        </div>
      )}

      <div>
        <Label className="text-xs font-semibold text-muted-foreground">
          {reimbursement.type === 'supplier_payment' ? 'Concepto' : 'Asunto'}
        </Label>
        <p className="text-sm mt-0.5">{reimbursement.subject}</p>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground">
          {reimbursement.type === 'supplier_payment' ? 'Datos Bancarios' : 'Info Bancaria'}
        </Label>
        <div className="text-sm space-y-0.5 mt-0.5">
          <p className="truncate">{reimbursement.account_info?.bank} - {reimbursement.account_info?.account_type}</p>
          <p className="font-mono text-xs">{reimbursement.account_info?.account_number}</p>
          <p className="text-xs">{reimbursement.account_info?.holder_name}</p>
        </div>
      </div>

      {Array.isArray(reimbursement.attachments) && reimbursement.attachments.length > 0 && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Cotización/Respaldos</Label>
          <div className="space-y-1.5 mt-1.5">
            {normalizeStoredFiles(reimbursement.attachments).map((file, idx: number) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="w-full justify-start h-8 text-xs"
                onClick={() => downloadFile(file.path, file.name)}
              >
                <Download className="w-3 h-3 mr-1.5" />
                <span className="truncate">{file.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {reimbursement.payment_proof && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Comprobante(s)</Label>
          {Array.isArray(reimbursement.payment_proof) ? (
            <div className="space-y-1.5 mt-1.5">
              {normalizeStoredFiles(reimbursement.payment_proof).map((proof, idx: number) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start h-8 text-xs"
                  onClick={() => downloadFile(proof.path, proof.name)}
                >
                  <Download className="w-3 h-3 mr-1.5" />
                  <span className="truncate">{proof.name}</span>
                </Button>
              ))}
            </div>
          ) : normalizeStoredFile(reimbursement.payment_proof)?.path ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start mt-1.5 h-8 text-xs"
                onClick={() => {
                  const proof = normalizeStoredFile(reimbursement.payment_proof!);
                  if (proof) {
                    void downloadFile(proof.path, proof.name);
                  }
                }}
              >
                <Download className="w-3 h-3 mr-1.5" />
                <span className="truncate">{normalizeStoredFile(reimbursement.payment_proof!)?.name}</span>
              </Button>
              {normalizeStoredFile(reimbursement.payment_proof!)?.uploaded_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(normalizeStoredFile(reimbursement.payment_proof!)!.uploaded_at!).toLocaleDateString('es-CL')}
                </p>
              )}
            </>
          ) : null}
        </div>
      )}

      {reimbursement.rejection_reason && (
        <div>
          <Label className="text-xs font-semibold text-destructive">Motivo de Rechazo</Label>
          <p className="text-sm mt-0.5">{reimbursement.rejection_reason}</p>
        </div>
      )}

      {canProcessReimbursements && reimbursement.status === 'pending' && (
        <div className="flex gap-2 pt-4">
          <Button
            onClick={() => {
              setSelectedReimbursement(reimbursement);
              setShowApproveDialog(true);
              setDetailsOpen(false);
            }}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            Aprobar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setSelectedReimbursement(reimbursement);
              setShowRejectDialog(true);
              setDetailsOpen(false);
            }}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Rechazar
          </Button>
        </div>
      )}

      {canProcessReimbursements && (reimbursement.status === 'approved' || reimbursement.status === 'rejected') && (
        <div className="flex gap-2 pt-4">
          <Button
            onClick={() => {
              setSelectedReimbursement(reimbursement);
              setShowReopenDialog(true);
              setDetailsOpen(false);
            }}
            variant="outline"
            className="flex-1"
          >
            <Clock className="w-4 h-4 mr-2" />
            Reabrir
          </Button>
          <Button
            onClick={() => {
              setSelectedReimbursement(reimbursement);
              setShowDeleteDialog(true);
              setDetailsOpen(false);
            }}
            variant="destructive"
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Eliminar
          </Button>
        </div>
      )}
    </div>
  );

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="amount">Monto</Label>
        <Input
          id="amount"
          type="text"
          inputMode="decimal"
          placeholder="Ingrese monto (use punto para decimales)"
          value={amount}
          onChange={(e) => {
            const value = e.target.value.replace(',', '.');
            if (value === '' || /^\d*\.?\d*$/.test(value)) {
              setAmount(value);
            }
          }}
          required
        />
      </div>

      <div>
        <Label htmlFor="subject">Asunto</Label>
        <Textarea
          id="subject"
          placeholder={type === 'supplier_payment' ? "Describa el servicio o producto" : "Describa el motivo de la rendición"}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>

      {type === 'reimbursement' ? (
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-semibold">Información de Cuenta Bancaria</h3>

          <div>
            <Label htmlFor="bank">Banco</Label>
            <div id="bank">
              <BankCombobox
                value={bank}
                onValueChange={setBank}
                placeholder="Seleccione un banco"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="accountType">Tipo de Cuenta</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger id="accountType">
                <SelectValue placeholder="Seleccione tipo de cuenta" />
              </SelectTrigger>
              <SelectContent>
                {CHILEAN_ACCOUNT_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="accountNumber">Numero de Cuenta</Label>
            <Input
              id="accountNumber"
              placeholder="Numero de cuenta"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="holderName">Nombre del Titular</Label>
            <Input
              id="holderName"
              placeholder="Nombre completo del titular"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              required
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 border-t pt-4">
          <div>
            <Label htmlFor="supplierName">Nombre del Proveedor</Label>
            <Input
              id="supplierName"
              placeholder="Nombre del proveedor del servicio"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="supplierRut">RUT del Proveedor</Label>
            <Input
              id="supplierRut"
              placeholder="12.345.678-9"
              value={supplierRut}
              onChange={(e) => setSupplierRut(e.target.value)}
              required
            />
          </div>

          <h3 className="font-semibold">Datos Bancarios del Proveedor</h3>

          <div>
            <Label htmlFor="bank">Banco</Label>
            <div id="bank">
              <BankCombobox
                value={bank}
                onValueChange={setBank}
                placeholder="Seleccione un banco"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="accountType">Tipo de Cuenta</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger id="accountType">
                <SelectValue placeholder="Seleccione tipo de cuenta" />
              </SelectTrigger>
              <SelectContent>
                {CHILEAN_ACCOUNT_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="accountNumber">Numero de Cuenta</Label>
            <Input
              id="accountNumber"
              placeholder="Numero de cuenta"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="holderName">Nombre del Titular</Label>
            <Input
              id="holderName"
              placeholder="Nombre completo del titular"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="files">
          {type === 'supplier_payment' ? 'Cotización (archivos adjuntos)' : 'Respaldos (archivos adjuntos)'}
        </Label>
        <Input
          id="files"
          type="file"
          multiple
          onChange={handleFileChange}
          className="cursor-pointer"
        />
        {files.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            {files.length} archivo(s) seleccionado(s)
          </p>
        )}
      </div>

      <Button type="submit" disabled={uploading} className="w-full">
        {uploading ? 'Creando...' : (type === 'supplier_payment' ? 'Crear Pago a Proveedor' : 'Crear Rendición')}
      </Button>
    </form>
  );

  const handleShareLink = async () => {
    if (!currentTenant?.id) {
      toast.error("No se pudo detectar el curso activo");
      return;
    }

    const { data: authData } = await supabase.auth.getSession();
    const accessToken = authData.session?.access_token;

    if (!accessToken) {
      toast.error("Sesión no válida. Vuelva a iniciar sesión.");
      return;
    }

    const { data, error } = await supabase.functions.invoke('create-supplier-request-link', {
      body: {
        tenantId: currentTenant.id,
        origin: window.location.origin,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error || !data?.url) {
      toast.error("No se pudo generar el link seguro para proveedor");
      return;
    }

    const link = data.url as string;

    // Verificar si el dispositivo soporta Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Portal de Pago a Proveedores',
          text: 'Completa tu solicitud de pago a través de este enlace',
          url: link,
        });
        toast.success("Enlace compartido");
      } catch (error) {
        // Si el usuario cancela, no mostrar error
        if ((error as Error).name !== 'AbortError') {
          // Fallback a copiar al portapapeles
          navigator.clipboard.writeText(link);
          toast.success("Enlace copiado al portapapeles");
        }
      }
    } else {
      // Fallback para navegadores que no soportan Web Share API
      navigator.clipboard.writeText(link);
      toast.success("Enlace copiado al portapapeles");
    }
  };

  return (
    <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pagos y Devoluciones</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gestiona rendiciones y pagos a proveedores
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleShareLink}
            variant="secondary"
            size={isMobile ? "sm" : "default"}
            className="w-full sm:w-auto"
          >
            <Share2 className="h-4 w-4 mr-2" />
            {isMobile ? "Compartir" : "Compartir con Proveedor"}
          </Button>

          {isMobile ? (
            <>
              <Drawer open={open && type === 'reimbursement'} onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (isOpen) setType('reimbursement');
                if (!isOpen) resetForm();
              }}>
                <DrawerTrigger asChild>
                  <Button size="sm" className="w-full sm:w-auto">Nueva Rendición</Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[90vh]">
                  <DrawerHeader className="pb-2">
                    <DrawerTitle>Nueva Rendición</DrawerTitle>
                    <DrawerDescription className="text-xs">
                      Solicita el reembolso de un gasto realizado
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="px-4 pb-4 overflow-y-auto">
                    {renderForm()}
                  </div>
                  <DrawerFooter className="pt-2">
                    <DrawerClose asChild>
                      <Button variant="outline" size="sm">Cancelar</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>

              <Drawer open={open && type === 'supplier_payment'} onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (isOpen) setType('supplier_payment');
                if (!isOpen) resetForm();
              }}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">Pago a Proveedor</Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[90vh]">
                  <DrawerHeader className="pb-2">
                    <DrawerTitle>Pago a Proveedor</DrawerTitle>
                    <DrawerDescription className="text-xs">
                      Registra un pago a realizar a un proveedor
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="px-4 pb-4 overflow-y-auto">
                    {renderForm()}
                  </div>
                  <DrawerFooter className="pt-2">
                    <DrawerClose asChild>
                      <Button variant="outline" size="sm">Cancelar</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </>
          ) : (
            <>
              <Dialog open={open && type === 'reimbursement'} onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (isOpen) setType('reimbursement');
                if (!isOpen) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>Nueva Rendición</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Nueva Rendición</DialogTitle>
                  </DialogHeader>
                  {renderForm()}
                </DialogContent>
              </Dialog>

              <Dialog open={open && type === 'supplier_payment'} onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (isOpen) setType('supplier_payment');
                if (!isOpen) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline">Pago a Proveedor</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Pago a Proveedor</DialogTitle>
                  </DialogHeader>
                  {renderForm()}
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {isMobile ? (
        <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Detalles de {selectedReimbursement?.type === 'supplier_payment' ? 'Pago a Proveedor' : 'Rendición'}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              {selectedReimbursement && renderReimbursementDetails(selectedReimbursement)}
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Cerrar</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles de {selectedReimbursement?.type === 'supplier_payment' ? 'Pago a Proveedor' : 'Rendición'}</DialogTitle>
            </DialogHeader>
            {selectedReimbursement && renderReimbursementDetails(selectedReimbursement)}
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de {isMobile ? 'Pagos y Devoluciones' : 'Pagos y Devoluciones'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Cargando...</p>
          ) : reimbursements.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay registros
            </p>
          ) : isMobile ? (
            <div className="space-y-3">
              {reimbursements.map((reimbursement) => (
                <ReimbursementCard key={reimbursement.id} reimbursement={reimbursement} />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Solicitado por</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reimbursements.map((reimbursement) => (
                  <TableRow key={reimbursement.id}>
                    <TableCell>#{reimbursement.folio}</TableCell>
                    <TableCell>
                      {reimbursement.type === 'supplier_payment' ? 'Pago a Proveedor' : 'Rendición'}
                    </TableCell>
                    <TableCell>{reimbursement.user_display_name || 'Usuario desconocido'}</TableCell>
                    <TableCell>{new Date(reimbursement.created_at).toLocaleDateString('es-CL')}</TableCell>
                    <TableCell className="max-w-xs truncate">{reimbursement.subject}</TableCell>
                    <TableCell className="font-semibold">${reimbursement.amount.toLocaleString('es-CL')}</TableCell>
                    <TableCell>{getStatusBadge(reimbursement.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReimbursement(reimbursement);
                            setDetailsOpen(true);
                          }}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        {canProcessReimbursements && reimbursement.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedReimbursement(reimbursement);
                                setShowApproveDialog(true);
                              }}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedReimbursement(reimbursement);
                                setShowRejectDialog(true);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showApproveDialog} onOpenChange={(open) => {
        setShowApproveDialog(open);
        if (!open) setProofFiles([]);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Aprobación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea aprobar {selectedReimbursement?.type === 'supplier_payment' ? 'este pago a proveedor' : 'esta rendición'}?
              Esta acción creará automáticamente un registro de egreso.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="proof">Comprobantes de Transferencia (opcional)</Label>
            <Input
              id="proof"
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  setProofFiles(Array.from(e.target.files));
                }
              }}
              className="cursor-pointer mt-2"
            />
            {proofFiles.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {proofFiles.length} archivo(s) seleccionado(s)
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProofFiles([])}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={uploadingProof}>
              {uploadingProof ? 'Aprobando...' : 'Aprobar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar {selectedReimbursement?.type === 'supplier_payment' ? 'Pago' : 'Rendición'}</AlertDialogTitle>
            <AlertDialogDescription>
              Ingrese el motivo del rechazo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo del rechazo"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject}>Rechazar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir {selectedReimbursement?.type === 'supplier_payment' ? 'Pago' : 'Rendición'}</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea reabrir {selectedReimbursement?.type === 'supplier_payment' ? 'este pago' : 'esta rendición'}?
              Esto eliminará el egreso asociado si existe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReopen}>Reabrir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {selectedReimbursement?.type === 'supplier_payment' ? 'Pago' : 'Rendición'}</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar permanentemente {selectedReimbursement?.type === 'supplier_payment' ? 'este pago' : 'esta rendición'}?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
