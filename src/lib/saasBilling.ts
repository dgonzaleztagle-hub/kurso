import type { Tenant } from "@/types/db";

export type PricingStage = "trial_conversion" | "intro_renewal" | "standard_renewal";

export const SAAS_PRICING = {
  trialDays: 7,
  introAmount: 5000,
  standardAmount: 9900,
  currency: "CLP",
  billingDays: 30,
  planCode: "kurso_monthly_v1",
} as const;

export const BILLING_WARNING_DAYS = 5;

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const endOfDayIso = (value: string) => `${value}T23:59:59`;

export const diffDaysFromNow = (value?: string | null) => {
  if (!value) return null;

  const raw = value.includes("T") ? value : endOfDayIso(value);
  const target = new Date(raw).getTime();
  if (Number.isNaN(target)) return null;

  return Math.ceil((target - Date.now()) / DAY_IN_MS);
};

export const formatCurrencyCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);

export const getSaasPricingStage = (tenant?: Tenant | null): PricingStage => {
  if (!tenant || tenant.subscription_status === "trial") {
    return "trial_conversion";
  }

  const paidCycleCount = Number(tenant.saas_paid_cycle_count ?? 0);
  return paidCycleCount <= 0 ? "intro_renewal" : "standard_renewal";
};

export const getSaasCheckoutOffer = (tenant?: Tenant | null) => {
  const stage = getSaasPricingStage(tenant);

  if (stage === "trial_conversion" || stage === "intro_renewal") {
    return {
      stage,
      amount: SAAS_PRICING.introAmount,
      currency: SAAS_PRICING.currency,
      label: "Primer mes a $5.000",
      summary: `7 días gratis, luego ${formatCurrencyCLP(SAAS_PRICING.introAmount)} el primer mes.`,
      renewalCopy: `Desde la siguiente renovación pagarás ${formatCurrencyCLP(SAAS_PRICING.standardAmount)} al mes.`,
    };
  }

  return {
    stage,
    amount: SAAS_PRICING.standardAmount,
    currency: SAAS_PRICING.currency,
    label: "Renovación mensual a $9.900",
    summary: `Renueva tu acceso por ${formatCurrencyCLP(SAAS_PRICING.standardAmount)} al mes.`,
    renewalCopy: "Renovación manual mes a mes, sin cobros automáticos.",
  };
};

export const getCommercialStatusLabel = (tenant?: Tenant | null) => {
  if (!tenant) return null;
  if (tenant.subscription_status === "trial") return "primer mes disponible";
  if (Number(tenant.saas_paid_cycle_count ?? 0) <= 0) return "primer mes disponible";
  if (Number(tenant.saas_paid_cycle_count ?? 0) === 1) return "primer mes usado";
  return "renovación regular";
};

export const getTenantBillingState = (tenant?: Tenant | null) => {
  const trialDaysRemaining = tenant?.subscription_status === "trial"
    ? diffDaysFromNow(tenant.trial_ends_at)
    : null;

  const activeDaysRemaining = tenant?.subscription_status === "active"
    ? diffDaysFromNow(tenant.valid_until)
    : null;

  const isTrialExpired = tenant?.subscription_status === "trial" && (trialDaysRemaining ?? -1) < 0;
  const isActiveExpired = tenant?.subscription_status === "active" && (activeDaysRemaining ?? -1) < 0;
  const isPastDue = tenant?.subscription_status === "past_due";
  const isGrace = tenant?.subscription_status === "grace_period";
  const isLocked = tenant?.subscription_status === "locked";
  const isNearExpiry = tenant?.subscription_status === "active" &&
    activeDaysRemaining !== null &&
    activeDaysRemaining >= 0 &&
    activeDaysRemaining <= BILLING_WARNING_DAYS;
  const offer = getSaasCheckoutOffer(tenant);

  return {
    trialDaysRemaining,
    activeDaysRemaining,
    isTrialExpired,
    isActiveExpired,
    isPastDue,
    isGrace,
    isLocked,
    isNearExpiry,
    offer,
    commercialStatus: getCommercialStatusLabel(tenant),
    isBlocked: Boolean(isGrace || isLocked || isPastDue || isTrialExpired || isActiveExpired),
    shouldShowPaymentCTA: Boolean(
      tenant?.subscription_status === "trial" ||
      isPastDue ||
      isGrace ||
      isLocked ||
      isActiveExpired ||
      isNearExpiry,
    ),
  };
};
