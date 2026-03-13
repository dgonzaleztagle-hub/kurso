import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_REQUEST_TYPES = new Set([
  "support",
  "payments",
  "credits",
  "security",
  "privacy",
  "arco_access",
  "arco_rectification",
  "arco_cancellation",
  "arco_opposition",
  "account_deletion",
]);

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const payload = await req.json().catch(() => ({}));
    const name = normalizeText(payload?.name, 120);
    const email = normalizeText(payload?.email, 160).toLowerCase();
    const subject = normalizeText(payload?.subject, 160);
    const message = normalizeText(payload?.message, 5000);
    const requestType = normalizeText(payload?.requestType, 64) || "support";
    const source = normalizeText(payload?.source, 32) || "web";
    const tenantId = normalizeText(payload?.tenantId, 64) || null;
    const tenantName = normalizeText(payload?.tenantName, 160) || null;

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Nombre, email, asunto y mensaje son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Debes ingresar un correo valido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!VALID_REQUEST_TYPES.has(requestType)) {
      return new Response(
        JSON.stringify({ error: "Tipo de solicitud no soportado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let userId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const { data, error } = await supabaseAdmin
      .from("support_requests")
      .insert({
        request_type: requestType,
        status: "open",
        name,
        email,
        subject,
        message,
        source,
        tenant_id: tenantId,
        tenant_name: tenantName,
        user_id: userId,
        metadata: {
          path: req.headers.get("origin") ?? null,
          userAgent: req.headers.get("user-agent") ?? null,
        },
      })
      .select("id, created_at")
      .single();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        request: data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
