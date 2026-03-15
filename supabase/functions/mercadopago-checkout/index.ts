import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API_BASE = "https://api.mercadopago.com";
const DEFAULT_PLAN_CODE = "kurso_monthly_v1";
const INTRO_AMOUNT = 5000;
const STANDARD_AMOUNT = 9900;

type CheckoutPayload = {
  tenantId?: string;
  tenantEmail?: string;
  tenantName?: string;
  appUrl?: string;
  promoCode?: string;
};

type PromoCodeRecord = {
  code: string;
  active: boolean;
  fixed_amount: number | string;
  max_redemptions: number;
  allowed_pricing_stages: string[] | null;
};

type PromoRedemptionRecord = {
  id: string;
  promo_code: string;
  tenant_id: string;
  checkout_reference: string;
  payment_id: string | null;
  status: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const resolvePricingStage = (subscriptionStatus: string | null, paidCycleCount: number) => {
  if (subscriptionStatus === "trial") return "trial_conversion";
  if (paidCycleCount <= 0) return "intro_renewal";
  return "standard_renewal";
};

const getOfferForStage = (pricingStage: string) => {
  if (pricingStage === "trial_conversion" || pricingStage === "intro_renewal") {
    return {
      amount: INTRO_AMOUNT,
      label: "Primer mes a $5.000",
      titleSuffix: "Primer mes promocional",
      description: "7 dias gratis, luego primer mes a $5.000. Renovacion manual.",
    };
  }

  return {
    amount: STANDARD_AMOUNT,
    label: "Renovacion mensual a $9.900",
    titleSuffix: "Renovacion mensual",
    description: "Renovacion manual Kurso por $9.900 mensuales.",
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpAccessToken) {
      return json({ error: "MP_ACCESS_TOKEN is not configured" }, 500);
    }

    const payload = (await req.json()) as CheckoutPayload;
    const tenantId = String(payload.tenantId ?? "").trim();
    if (!tenantId) {
      return json({ error: "tenantId is required" }, 400);
    }

    const [
      { data: appUser },
      { data: ownerTenant },
      { data: membership },
      { data: tenant, error: tenantError },
      { data: plan, error: planError },
    ] = await Promise.all([
      supabaseAdmin.from("app_users").select("is_superadmin, email, full_name").eq("id", authData.user.id).maybeSingle(),
      supabaseAdmin.from("tenants").select("id").eq("id", tenantId).eq("owner_id", authData.user.id).maybeSingle(),
      supabaseAdmin.from("tenant_members").select("tenant_id").eq("tenant_id", tenantId).eq("user_id", authData.user.id).eq("status", "active").maybeSingle(),
      supabaseAdmin
        .from("tenants")
        .select("id, name, slug, valid_until, subscription_status, saas_paid_cycle_count")
        .eq("id", tenantId)
        .maybeSingle(),
      supabaseAdmin.from("saas_plans").select("*").eq("code", DEFAULT_PLAN_CODE).eq("is_active", true).maybeSingle(),
    ]);

    if (tenantError || !tenant) {
      return json({ error: "Tenant not found" }, 404);
    }

    if (planError || !plan) {
      return json({ error: "Active SaaS plan not found" }, 500);
    }

    const canManageBilling = Boolean(appUser?.is_superadmin || ownerTenant || membership);
    if (!canManageBilling) {
      return json({ error: "Forbidden" }, 403);
    }

    const origin = String(payload.appUrl ?? req.headers.get("origin") ?? "").replace(/\/$/, "");
    if (!origin) {
      return json({ error: "Unable to resolve app URL" }, 400);
    }

    const pricingStage = resolvePricingStage(
      String(tenant.subscription_status ?? ""),
      Number(tenant.saas_paid_cycle_count ?? 0),
    );
    const promoCode = String(payload.promoCode ?? "").trim().toUpperCase();
    const baseOffer = getOfferForStage(pricingStage);
    let offer = baseOffer;
    let promoRedemptionId: string | null = null;
    let createdPromoReservation = false;

    if (promoCode) {
      const promoResponse = await supabaseAdmin
        .from("saas_promo_codes")
        .select("code, active, fixed_amount, max_redemptions, allowed_pricing_stages")
        .eq("code", promoCode)
        .maybeSingle();
      const promo = promoResponse.data as PromoCodeRecord | null;
      const promoError = promoResponse.error;

      if (promoError || !promo || !promo.active) {
        return json({ error: "El código de descuento no es válido." }, 400);
      }

      if (Array.isArray(promo.allowed_pricing_stages) && promo.allowed_pricing_stages.length > 0 && !promo.allowed_pricing_stages.includes(pricingStage)) {
        return json({ error: "Este código no aplica al estado actual de tu suscripción." }, 400);
      }

      const redemptionLookupResponse = await supabaseAdmin
        .from("saas_promo_redemptions")
        .select("id, promo_code, tenant_id, checkout_reference, payment_id, status")
        .eq("promo_code", promo.code)
        .in("status", ["checkout_created", "approved"])
        .maybeSingle();
      const existingRedemption = redemptionLookupResponse.data as PromoRedemptionRecord | null;
      const redemptionLookupError = redemptionLookupResponse.error;

      if (redemptionLookupError) {
        return json({ error: "No fue posible validar el código de descuento." }, 500);
      }

      if (existingRedemption && existingRedemption.tenant_id !== tenant.id) {
        return json({ error: "Este código ya fue utilizado." }, 400);
      }

      if (existingRedemption?.status === "approved") {
        return json({ error: "Este código ya fue utilizado." }, 400);
      }

      if (existingRedemption) {
        promoRedemptionId = existingRedemption.id;
      } else {
        const { count: redemptionCount, error: redemptionCountError } = await supabaseAdmin
          .from("saas_promo_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("promo_code", promo.code)
          .eq("status", "approved");

        if (redemptionCountError) {
          return json({ error: "No fue posible validar el uso disponible del código." }, 500);
        }

        if ((redemptionCount ?? 0) >= Number(promo.max_redemptions ?? 1)) {
          return json({ error: "Este código ya fue utilizado." }, 400);
        }
      }

      offer = {
        amount: Number(promo.fixed_amount),
        label: `Activación de prueba por $${Number(promo.fixed_amount).toLocaleString("es-CL")}`,
        titleSuffix: "Activación con código de prueba",
        description: `Cobro único de prueba Kurso por $${Number(promo.fixed_amount).toLocaleString("es-CL")} mediante código interno.`,
      };
    }

    const baseDate = tenant.valid_until && tenant.valid_until >= new Date().toISOString().slice(0, 10)
      ? tenant.valid_until
      : new Date().toISOString().slice(0, 10);
    const billingCycle = String(baseDate).slice(0, 7);
    let checkoutReference = crypto.randomUUID();
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`;
    const payerEmail = String(payload.tenantEmail ?? authData.user.email ?? appUser?.email ?? "").trim();
    const payerName = String(payload.tenantName ?? appUser?.full_name ?? tenant.name).trim();

    if (promoCode && promoRedemptionId) {
      const redemptionLookupResponse = await supabaseAdmin
        .from("saas_promo_redemptions")
        .select("checkout_reference")
        .eq("id", promoRedemptionId)
        .maybeSingle();
      const redemptionReference = redemptionLookupResponse.data as { checkout_reference: string } | null;
      if (redemptionReference?.checkout_reference) {
        checkoutReference = redemptionReference.checkout_reference;
      }
    }

    if (promoCode && !promoRedemptionId) {
      const createRedemptionResponse = await supabaseAdmin
        .from("saas_promo_redemptions")
        .insert({
          promo_code: promoCode,
          tenant_id: tenant.id,
          checkout_reference: checkoutReference,
          status: "checkout_created",
        })
        .select("id")
        .maybeSingle();
      const createdRedemption = createRedemptionResponse.data as { id: string } | null;
      const createRedemptionError = createRedemptionResponse.error;

      if (createRedemptionError || !createdRedemption) {
        return json({ error: "No fue posible reservar el código de descuento." }, 400);
      }

      promoRedemptionId = createdRedemption.id;
      createdPromoReservation = true;
    }

    const externalReference = `${tenant.id}|${pricingStage}|${billingCycle}|${checkoutReference}`;

    const preferenceResponse = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        items: [
          {
            id: `${plan.code}:${pricingStage}`,
            title: `${plan.name} - ${offer.titleSuffix}`,
            description: offer.description,
            quantity: 1,
            currency_id: plan.currency,
            unit_price: offer.amount,
          },
        ],
        payer: {
          email: payerEmail || undefined,
          name: payerName || undefined,
        },
        metadata: {
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          plan_code: plan.code,
          pricing_stage: pricingStage,
          expected_amount: offer.amount,
          billing_cycle: billingCycle,
          checkout_reference: checkoutReference,
          promo_code: promoCode || null,
          promo_redemption_id: promoRedemptionId,
        },
        external_reference: externalReference,
        back_urls: {
          success: `${origin}/pago-exitoso`,
          pending: `${origin}/pago-pendiente`,
          failure: `${origin}/pago-fallido`,
        },
        auto_return: "approved",
        notification_url: webhookUrl,
        statement_descriptor: "KURSO",
      }),
    });

    const preferenceData = await preferenceResponse.json();
    if (!preferenceResponse.ok) {
      if (createdPromoReservation && promoRedemptionId) {
        await supabaseAdmin.from("saas_promo_redemptions").delete().eq("id", promoRedemptionId);
      }

      return json({
        error: "Mercado Pago preference creation failed",
        details: preferenceData,
      }, 502);
    }

    return json({
      preferenceId: preferenceData.id,
      initPoint: preferenceData.init_point,
      sandboxInitPoint: preferenceData.sandbox_init_point,
      externalReference,
      pricingStage,
      amount: offer.amount,
      currency: plan.currency,
      label: offer.label,
      promoCodeApplied: promoCode || null,
      plan: {
        code: plan.code,
        name: plan.name,
        amount: offer.amount,
        currency: plan.currency,
        billingDays: plan.billing_days,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
