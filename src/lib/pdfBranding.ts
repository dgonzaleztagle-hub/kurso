import { resolveBranding } from "@/lib/branding";

type TenantLike = {
  name?: string | null;
  settings?: Record<string, unknown> | null;
} | null | undefined;

export const loadImageElement = async (src?: string | null, fallback?: string): Promise<HTMLImageElement | null> => {
  const resolvedSrc = src || fallback;
  if (!resolvedSrc) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (fallback && resolvedSrc !== fallback) {
        loadImageElement(fallback).then(resolve);
        return;
      }
      resolve(null);
    };
    img.src = resolvedSrc;
  });
};

export const getPdfBranding = (tenant?: TenantLike) => {
  const branding = resolveBranding(tenant?.settings, tenant?.name);

  return {
    ...branding,
    logoUrl: branding.logoUrl || null,
    reportSubtitle: branding.institutionName || branding.appName,
    signatureCourseLine: tenant?.name ? `Directiva ${tenant.name}` : "Directiva",
    signatureInstitutionLine: branding.institutionName || branding.appName,
  };
};
