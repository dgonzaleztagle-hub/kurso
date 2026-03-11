import { useState } from "react";
import { BankCombobox } from "@/components/BankCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CHILEAN_ACCOUNT_TYPES } from "@/lib/banking";
import { resolveBranding } from "@/lib/branding";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function SupplierPaymentRequest() {
  const branding = resolveBranding();
  const signedToken = new URLSearchParams(window.location.search).get("token");
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

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!signedToken) {
        toast.error("Solicitud inválida o vencida");
        setLoading(false);
        return;
      }

      // Validaciones
      if (
        !formData.supplier_name ||
        !formData.bank ||
        !formData.account_type ||
        !formData.account_number ||
        !formData.holder_name ||
        !formData.holder_rut ||
        !formData.amount ||
        !formData.subject
      ) {
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

      const encodedFiles = [];
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        encodedFiles.push({
          name: file.name,
          type: file.type || "application/octet-stream",
          dataUrl,
        });
      }

      const { data, error: submitError } = await supabase.functions.invoke("submit-supplier-payment-request", {
        body: {
          token: signedToken,
          formData: {
            supplier_name: formData.supplier_name,
            rut: formData.rut,
            email: formData.email,
            phone: formData.phone,
            bank: formData.bank,
            account_type: formData.account_type,
            account_number: formData.account_number,
            holder_name: formData.holder_name,
            holder_rut: formData.holder_rut,
            amount,
            subject: formData.subject,
          },
          files: encodedFiles,
        },
      });

      if (submitError || !data?.success) {
        console.error('Error creating request:', submitError || data);
        toast.error(data?.error || "Error al crear la solicitud");
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
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.appName} className="h-14 md:h-20 mx-auto mb-2 md:mb-4 object-contain" />
          ) : null}
          <h1 className="text-xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">
            Solicitud de Pago a Proveedor
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {branding.supplierPortalSubtitle}
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
                  <div id="bank">
                    <BankCombobox
                      value={formData.bank}
                      onValueChange={(value) => setFormData({ ...formData, bank: value })}
                      placeholder="Seleccione un banco"
                    />
                  </div>
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
                        {CHILEAN_ACCOUNT_TYPES.map((accountType) => (
                          <SelectItem key={accountType} value={accountType}>
                            {accountType}
                          </SelectItem>
                        ))}
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
