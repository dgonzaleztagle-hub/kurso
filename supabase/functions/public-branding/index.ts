import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_BRANDING_KEYS = [
  "institution_name",
  "app_name",
  "brand_name",
  "logo_url",
  "brand_logo_url",
  "icon_url",
  "brand_icon_url",
  "legal_name",
  "supplier_portal_subtitle",
  "public_form_footer",
] as const;

const pickPublicBrandingSettings = (settings: unknown): Record<string, unknown> => {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  const source = settings as Record<string, unknown>;
  return PUBLIC_BRANDING_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    if (source[key] !== undefined && source[key] !== null) {
      acc[key] = source[key];
    }
    return acc;
  }, {});
};

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  return atob(padded);
}

async function signPayload(payloadB64: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const formId = typeof body?.formId === "string" ? body.formId.trim() : "";
    const supplierToken = typeof body?.supplierToken === "string" ? body.supplierToken.trim() : "";

    let tenantId = "";

    if (formId) {
      const { data: formRow, error: formError } = await supabaseAdmin
        .from("forms")
        .select("tenant_id, is_active, requires_login, closes_at")
        .eq("id", formId)
        .maybeSingle();

      if (formError || !formRow?.tenant_id) {
        return new Response(JSON.stringify({ error: "Formulario no encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isClosed = Boolean(formRow.closes_at) && new Date(String(formRow.closes_at)).getTime() < Date.now();
      if (!formRow.is_active || formRow.requires_login || isClosed) {
        return new Response(JSON.stringify({ error: "Formulario no disponible para branding publico" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      tenantId = String(formRow.tenant_id);
    } else if (supplierToken) {
      const secret = Deno.env.get("SUPPLIER_LINK_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!secret) {
        return new Response(JSON.stringify({ error: "Falta SUPPLIER_LINK_SECRET en Edge Functions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [payloadB64, signature] = supplierToken.split(".");
      if (!payloadB64 || !signature) {
        return new Response(JSON.stringify({ error: "Token malformado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expectedSig = await signPayload(payloadB64, secret);
      if (expectedSig !== signature) {
        return new Response(JSON.stringify({ error: "Token invalido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.parse(base64UrlDecode(payloadB64));
      const exp = Number(payload?.exp ?? 0);
      if (!payload?.tenant_id || !exp || Date.now() / 1000 > exp) {
        return new Response(JSON.stringify({ error: "Token vencido o invalido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      tenantId = String(payload.tenant_id);
    } else {
      return new Response(JSON.stringify({ error: "formId o supplierToken son requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenantRow, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("name, settings")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !tenantRow) {
      return new Response(JSON.stringify({ error: "Tenant no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      tenantName: tenantRow.name,
      settings: pickPublicBrandingSettings(tenantRow.settings),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
