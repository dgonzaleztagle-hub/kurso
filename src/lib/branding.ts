const DEFAULT_PLATFORM_NAME = "Kurso";
const DEFAULT_LOGO_URL = "/kurso-logo-full.png";
const DEFAULT_ICON_URL = "/kurso-icon.png";
type RawSettings = Record<string, unknown> | null | undefined;

const readSetting = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveBranding = (settings?: RawSettings, tenantName?: string | null) => {
  const institutionName = readSetting(settings?.institution_name) || tenantName || null;
  const appName =
    readSetting(settings?.app_name) ||
    readSetting(settings?.brand_name) ||
    institutionName ||
    DEFAULT_PLATFORM_NAME;

  const adminTitle = readSetting(settings?.admin_title) || `${appName} Admin`;
  const customLogoUrl =
    readSetting(settings?.logo_url) ||
    readSetting(settings?.brand_logo_url);
  const customIconUrl =
    readSetting(settings?.icon_url) ||
    readSetting(settings?.brand_icon_url);
  const logoUrl = customLogoUrl || DEFAULT_LOGO_URL;
  const iconUrl = customIconUrl || customLogoUrl || DEFAULT_ICON_URL;

  return {
    appName,
    adminTitle,
    institutionName,
    logoUrl,
    iconUrl,
    authDescription:
      readSetting(settings?.auth_description) || "Inicia sesion en tu cuenta",
    authFooter:
      readSetting(settings?.auth_footer) || "Plataforma de gestion educativa",
    legalName: readSetting(settings?.legal_name) || appName,
    onboardingTitle:
      readSetting(settings?.onboarding_title) || `Bienvenido a ${appName}`,
    onboardingDescription:
      readSetting(settings?.onboarding_description) ||
      "Necesitamos crear tu primer espacio de trabajo.",
    supplierPortalSubtitle:
      readSetting(settings?.supplier_portal_subtitle) ||
      (institutionName ? `Portal de proveedores de ${institutionName}` : "Portal externo de proveedores"),
    publicFormFooter:
      readSetting(settings?.public_form_footer) || `Formulario habilitado por ${appName}`,
  };
};
