import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenantId, origin } = await req.json();
    if (!tenantId || !origin) {
      return new Response(JSON.stringify({ error: "tenantId y origin son requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: appUser }, { data: ownerTenant }, { data: memberRole }] = await Promise.all([
      supabaseAdmin.from("app_users").select("is_superadmin").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("tenants").select("id").eq("id", tenantId).eq("owner_id", user.id).maybeSingle(),
      supabaseAdmin
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .in("role", ["owner", "master", "admin"])
        .eq("status", "active")
        .maybeSingle(),
    ]);

    const canGenerate = Boolean(appUser?.is_superadmin || ownerTenant || memberRole);
    if (!canGenerate) {
      return new Response(JSON.stringify({ error: "No autorizado para generar links de proveedor" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secret = Deno.env.get("SUPPLIER_LINK_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret) {
      return new Response(JSON.stringify({ error: "Falta SUPPLIER_LINK_SECRET en Edge Functions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 días
    const payload = JSON.stringify({
      tenant_id: tenantId,
      requested_by: user.id,
      exp,
    });
    const payloadB64 = base64UrlEncode(payload);
    const sig = await signPayload(payloadB64, secret);
    const signedToken = `${payloadB64}.${sig}`;
    const url = `${origin.replace(/\/$/, "")}/solicitud-pago-proveedor?token=${encodeURIComponent(signedToken)}`;

    return new Response(JSON.stringify({ success: true, url, expires_at_unix: exp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
