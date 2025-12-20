import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import logoSantaCruz from "@/assets/logo-santa-cruz.png";

const BANKS = [
  "Banco de Chile",
  "Banco Estado",
  "Banco Santander",
  "BCI",
  "Scotiabank",
  "Banco Itaú",
  "Banco Security",
  "Banco Falabella",
  "Banco Ripley",
  "Banco Consorcio",
  "Banco BICE",
  "BBVA",
  "Coopeuch",
  "Otro"
];

export default function SupplierPaymentRequest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplier_name: "",
    rut: "",
    email: "",
    phone: "",
    bank: "",
    account_type: "",
    account_number: "",
    holder_name: "",
    holder_rut: "",
    amount: "",
    subject: "",
  });
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validaciones
      if (!formData.supplier_name || !formData.amount || !formData.subject) {
        toast.error("Por favor complete todos los campos obligatorios");
        setLoading(false);
        return;
      }

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("El monto debe ser un número válido mayor a 0");
        setLoading(false);
        return;
      }

      // Subir archivos adjuntos
      const attachmentUrls: string[] = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `supplier-requests/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('reimbursements')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          toast.error(`Error al subir archivo: ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('reimbursements')
          .getPublicUrl(fileName);

        attachmentUrls.push(publicUrl);
      }

      // Crear solicitud de pago a proveedor (el trigger asignará el folio automáticamente)
      const { error: insertError } = await supabase
        .from('reimbursements')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // ID especial para solicitudes públicas
          type: 'supplier_payment',
          status: 'pending',
          supplier_name: formData.supplier_name,
          amount: amount,
          subject: formData.subject,
          account_info: {
            bank: formData.bank,
            account_type: formData.account_type,
            account_number: formData.account_number,
            holder_name: formData.holder_name,
            holder_rut: formData.holder_rut,
            supplier_rut: formData.rut,
            supplier_email: formData.email,
            supplier_phone: formData.phone,
          },
          attachments: attachmentUrls,
        });

      if (insertError) {
        console.error('Error creating request:', insertError);
        toast.error("Error al crear la solicitud");
        setLoading(false);
        return;
      }

      toast.success("¡Solicitud enviada exitosamente! Será revisada pronto.");
      
      // Resetear formulario
      setFormData({
        supplier_name: "",
        rut: "",
        email: "",
        phone: "",
        bank: "",
        account_type: "",
        account_number: "",
        holder_name: "",
        holder_rut: "",
        amount: "",
        subject: "",
      });
      setFiles([]);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error("Error al procesar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-3 md:py-8 px-3 md:px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-4 md:mb-8">
          <img src={logoSantaCruz} alt="Logo" className="h-14 md:h-20 mx-auto mb-2 md:mb-4" />
          <h1 className="text-xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">
            Solicitud de Pago a Proveedor
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Pre Kinder B - Colegio Santa Cruz de Chicureo
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-base md:text-xl">Datos del Proveedor</CardTitle>
            <CardDescription className="text-sm">
              Complete el formulario para enviar su solicitud de pago
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              {/* Información del Proveedor */}
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-base md:text-lg font-semibold">Información del Proveedor</h3>
                
                <div className="space-y-1.5">
                  <Label htmlFor="supplier_name" className="text-sm">Razón Social o Nombre *</Label>
                  <Input
                    id="supplier_name"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="rut" className="text-sm">RUT</Label>
                    <Input
                      id="rut"
                      placeholder="12.345.678-9"
                      value={formData.rut}
                      onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm">Teléfono</Label>
                  <Input
                    id="phone"
                    placeholder="+56912345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Datos Bancarios */}
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-base md:text-lg font-semibold">Datos Bancarios</h3>
                
                <div className="space-y-1.5">
                  <Label htmlFor="bank" className="text-sm">Banco *</Label>
                  <Select
                    value={formData.bank}
                    onValueChange={(value) => setFormData({ ...formData, bank: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {BANKS.map((bank) => (
                        <SelectItem key={bank} value={bank}>
                          {bank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="account_type" className="text-sm">Tipo de Cuenta *</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cuenta Corriente">Cuenta Corriente</SelectItem>
                        <SelectItem value="Cuenta Vista">Cuenta Vista</SelectItem>
                        <SelectItem value="Cuenta de Ahorro">Cuenta de Ahorro</SelectItem>
                        <SelectItem value="Cuenta RUT">Cuenta RUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="account_number" className="text-sm">Número de Cuenta *</Label>
                    <Input
                      id="account_number"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="holder_name">Titular de la Cuenta *</Label>
                    <Input
                      id="holder_name"
                      value={formData.holder_name}
                      onChange={(e) => setFormData({ ...formData, holder_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="holder_rut">RUT del Titular *</Label>
                    <Input
                      id="holder_rut"
                      placeholder="12.345.678-9"
                      value={formData.holder_rut}
                      onChange={(e) => setFormData({ ...formData, holder_rut: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Detalles del Pago */}
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-base md:text-lg font-semibold">Detalles del Pago</h3>
                
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-sm">Monto *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-sm">Concepto/Asunto *</Label>
                  <Textarea
                    id="subject"
                    placeholder="Describa el servicio o producto a pagar"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    rows={4}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="files" className="text-sm">Documentos (Factura, Boleta, etc.)</Label>
                  <div className="mt-2">
                    <Input
                      id="files"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        if (e.target.files) {
                          setFiles(Array.from(e.target.files));
                        }
                      }}
                      className="cursor-pointer"
                    />
                  </div>
                  {files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {files.map((file, index) => (
                        <div key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-4 pt-2 md:pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="w-full md:w-auto text-sm md:text-base"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-sm md:text-base"
                >
                  {loading ? "Enviando..." : "Enviar Solicitud"}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Su solicitud será revisada por el equipo administrativo. Recibirá una confirmación una vez procesada.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
