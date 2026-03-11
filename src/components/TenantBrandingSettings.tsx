import { ChangeEvent, useEffect, useState } from "react";
import { Building2, ImagePlus, School, Upload } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { resolveBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TenantSettings = Record<string, unknown>;

export function TenantBrandingSettings() {
  const { currentTenant, refreshTenants, roleInCurrentTenant } = useTenant();
  const { appUser, userRole } = useAuth();
  const branding = resolveBranding(currentTenant?.settings, currentTenant?.name);

  const [institutionName, setInstitutionName] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    const settings = (currentTenant?.settings as TenantSettings | null) || {};
    setInstitutionName(typeof settings.institution_name === "string" ? settings.institution_name : "");
  }, [currentTenant]);

  const updateTenantSettings = async (partialSettings: TenantSettings) => {
    if (!currentTenant) return null;

    const currentSettings = (currentTenant.settings as TenantSettings | null) || {};
    const updatedSettings = {
      ...currentSettings,
      ...partialSettings,
    };

    const { data, error } = await supabase
      .from("tenants")
      .update({ settings: updatedSettings })
      .eq("id", currentTenant.id)
      .select("settings")
      .single();

    if (error) throw error;

    await refreshTenants(currentTenant.id);
    return data?.settings || updatedSettings;
  };

  const handleSaveBranding = async () => {
    if (!currentTenant) return;
    if (!institutionName.trim()) {
      toast.error("Ingrese el nombre del colegio");
      return;
    }

    try {
      setBrandingSaving(true);
      await updateTenantSettings({
        institution_name: institutionName.trim(),
      });
      toast.success("Identidad del curso actualizada");
    } catch (error) {
      console.error("Error updating branding:", error);
      toast.error("No se pudo guardar la identidad del curso");
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!currentTenant) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLogoUploading(true);
      const fileExt = file.name.split(".").pop() || "png";
      const objectPath = `${currentTenant.id}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-branding")
        .upload(objectPath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("tenant-branding").getPublicUrl(objectPath);
      await updateTenantSettings({ logo_url: data.publicUrl });
      toast.success("Logo actualizado");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("No se pudo subir el logo");
    } finally {
      setLogoUploading(false);
      event.target.value = "";
    }
  };

  const canEdit =
    appUser?.is_superadmin ||
    userRole === "master" ||
    roleInCurrentTenant === "owner" ||
    roleInCurrentTenant === "admin" ||
    roleInCurrentTenant === "master";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Identidad del Curso
        </CardTitle>
        <CardDescription>
          Configura el colegio y el logo opcional para la marca blanca del curso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border bg-muted/30">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.appName} className="h-full w-full object-contain" />
              ) : (
                <School className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <Label
              htmlFor="tenant-logo"
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                canEdit ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-60"
              }`}
            >
              {logoUploading ? <Upload className="h-4 w-4 animate-pulse" /> : <ImagePlus className="h-4 w-4" />}
              {logoUploading ? "Subiendo..." : "Subir logo"}
            </Label>
            <Input
              id="tenant-logo"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={!canEdit || logoUploading}
              className="hidden"
            />
          </div>

          <div className="grid flex-1 gap-4">
            <div className="grid gap-2">
              <Label>Curso</Label>
              <Input value={currentTenant?.name || ""} disabled />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="institutionName">Colegio</Label>
              <Input
                id="institutionName"
                value={institutionName}
                onChange={(event) => setInstitutionName(event.target.value)}
                placeholder="Ej. Colegio Santa Maria"
                disabled={!canEdit}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveBranding} disabled={!canEdit || brandingSaving || !institutionName.trim()}>
                {brandingSaving ? "Guardando..." : "Guardar identidad"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
