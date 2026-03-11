import { TenantBrandingSettings } from "@/components/TenantBrandingSettings";

export default function TenantBranding() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold">Marca Blanca</h1>
        <p className="text-muted-foreground">
          Administra el nombre del colegio y el logo opcional que usa el curso en la plataforma y los reportes.
        </p>
      </div>

      <TenantBrandingSettings />
    </div>
  );
}
