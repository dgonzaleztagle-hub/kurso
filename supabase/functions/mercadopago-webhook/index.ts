import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API_BASE = "https://api.mercadopago.com";
const INTRO_AMOUNT = 5000;
const STANDARD_AMOUNT = 9900;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safeJsonParse = async (req: Request) => {
  const bodyText = await req.text();
  if (!bodyText) return null;

  try {
    return JSON.parse(bodyText);
  } catch {
    return { raw: bodyText };
  }
};

type WebhookPayload = {
  id?: string | number | null;
  resource?: string | null;
  data?: { id?: string | number | null } | null;
};

const extractPaymentId = (payload: WebhookPayload | null, url: URL): string | null => {
  const candidates = [
    payload?.data?.id,
    payload?.id,
    url.searchParams.get("data.id"),
    url.searchParams.get("id"),
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== "") {
      return String(candidate).trim();
    }
  }

  const resource = String(payload?.resource ?? url.searchParams.get("resource") ?? "").trim();
  const match = resource.match(/payments\/(\d+)/i);
  return match?.[1] ?? null;
};

const getExpectedAmount = (subscriptionStatus: string | null, paidCycleCount: number) => {
  if (subscriptionStatus === "trial") {
    return {
      pricingStage: "trial_conversion",
      expectedAmount: INTRO_AMOUNT,
    };
  }

  if (paidCycleCount <= 0) {
    return {
      pricingStage: "intro_renewal",
      expectedAmount: INTRO_AMOUNT,
    };
  }

  return {
    pricingStage: "standard_renewal",
    expectedAmount: STANDARD_AMOUNT,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpAccessToken) {
      return json({ error: "MP_ACCESS_TOKEN is not configured" }, 500);
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

    const url = new URL(req.url);
    const payload = req.method === "POST" ? await safeJsonParse(req) : null;
    const paymentId = extractPaymentId(payload, url);

    if (!paymentId) {
      return json({ received: true, ignored: true, reason: "payment id not found" });
    }

    const paymentResponse = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
      },
    });
    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return json({
        error: "Mercado Pago payment lookup failed",
        paymentId,
        details: payment,
      }, 502);
    }

    const externalReference = String(payment.external_reference ?? "").trim();
    const referenceParts = externalReference.split("|");
    const tenantId = String(payment.metadata?.tenant_id ?? referenceParts[0] ?? "").trim();
    const pricingStageFromReference = String(payment.metadata?.pricing_stage ?? referenceParts[1] ?? "").trim() || null;
    const planCode = String(payment.metadata?.plan_code ?? "kurso_monthly_v1").trim() || null;

    if (!tenantId) {
      return json({
        received: true,
        ignored: true,
        paymentId,
        reason: "tenant reference not found",
      });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, subscription_status, saas_paid_cycle_count")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return json({
        error: "Tenant not found for incoming payment",
        paymentId,
        details: tenantError,
      }, 404);
    }

    const expectation = getExpectedAmount(
      String(tenant.subscription_status ?? ""),
      Number(tenant.saas_paid_cycle_count ?? 0),
    );
    const actualAmount = payment.transaction_amount != null ? Number(payment.transaction_amount) : null;
    const expectedAmount = Number(payment.metadata?.expected_amount ?? expectation.expectedAmount);
    const resolvedPricingStage = pricingStageFromReference ?? expectation.pricingStage;
    const requiresManualReview = actualAmount === null || actualAmount !== expectedAmount;

    const now = new Date().toISOString();
    const logRecord = {
      payment_id: paymentId,
      tenant_id: tenantId,
      plan_code: planCode,
      pricing_stage: requiresManualReview ? "mismatch/manual_review" : resolvedPricingStage,
      external_reference: externalReference || null,
      status: String(payment.status ?? "unknown"),
      status_detail: payment.status_detail ? String(payment.status_detail) : null,
      amount: actualAmount,
      expected_amount: expectedAmount,
      currency: payment.currency_id ? String(payment.currency_id) : null,
      payment_method: payment.payment_method_id ? String(payment.payment_method_id) : null,
      payer_email: payment.payer?.email ? String(payment.payer.email) : null,
      requires_manual_review: requiresManualReview,
      raw_data: payment,
      webhook_payload: payload,
      updated_at: now,
    };

    const { error: upsertError } = await supabaseAdmin
      .from("saas_payment_logs")
      .upsert(logRecord, { onConflict: "payment_id" });

    if (upsertError) {
      return json({
        error: "Failed to persist payment log",
        paymentId,
        details: upsertError,
      }, 500);
    }

    if (String(payment.status) !== "approved" || requiresManualReview) {
      return json({
        received: true,
        paymentId,
        status: payment.status,
        applied: false,
        requiresManualReview,
      });
    }

    const { data: applyResult, error: applyError } = await supabaseAdmin
      .rpc("apply_saas_payment_log", { target_payment_id: paymentId });

    if (applyError) {
      return json({
        error: "Failed to apply approved payment",
        paymentId,
        details: applyError,
      }, 500);
    }

    return json({
      received: true,
      paymentId,
      status: payment.status,
      applied: Array.isArray(applyResult) ? applyResult[0]?.applied ?? false : false,
      validUntil: Array.isArray(applyResult) ? applyResult[0]?.valid_until ?? null : null,
      paidCycleCount: Array.isArray(applyResult) ? applyResult[0]?.paid_cycle_count ?? null : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
