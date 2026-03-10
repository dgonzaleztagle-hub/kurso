import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UploadedFile = {
  name: string;
  type: string;
  dataUrl: string;
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

function decodeDataUrl(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) throw new Error("Archivo inválido");
  const base64 = dataUrl.slice(commaIndex + 1);
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const secret = Deno.env.get("SUPPLIER_LINK_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret) {
      return new Response(JSON.stringify({ error: "Falta SUPPLIER_LINK_SECRET en Edge Functions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const token = String(body?.token ?? "");
    const formData = body?.formData ?? {};
    const files = Array.isArray(body?.files) ? (body.files as UploadedFile[]) : [];

    if (!token) {
      return new Response(JSON.stringify({ error: "Token inválido o ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) {
      return new Response(JSON.stringify({ error: "Token malformado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedSig = await signPayload(payloadB64, secret);
    if (expectedSig !== signature) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const tenantId = String(payload?.tenant_id ?? "");
    const exp = Number(payload?.exp ?? 0);

    if (!tenantId || !exp || Date.now() / 1000 > exp) {
      return new Response(JSON.stringify({ error: "Token vencido o inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supplierName = String(formData?.supplier_name ?? "").trim();
    const subject = String(formData?.subject ?? "").trim();
    const amount = Number(formData?.amount ?? 0);

    if (!supplierName || !subject || !Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "Datos obligatorios inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxFiles = 5;
    if (files.length > maxFiles) {
      return new Response(JSON.stringify({ error: `Máximo ${maxFiles} archivos por solicitud` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attachmentUrls: string[] = [];

    for (const file of files) {
      if (!file?.name || !file?.dataUrl) continue;

      const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const objectPath = `supplier-requests/${tenantId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      const bytes = decodeDataUrl(file.dataUrl);

      const maxBytes = 8 * 1024 * 1024;
      if (bytes.byteLength > maxBytes) {
        return new Response(JSON.stringify({ error: `Archivo ${file.name} supera 8MB` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: uploadError } = await supabaseAdmin.storage
        .from("reimbursements")
        .upload(objectPath, bytes, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        return new Response(JSON.stringify({ error: `No se pudo subir ${file.name}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("reimbursements").getPublicUrl(objectPath);
      attachmentUrls.push(publicUrl);
    }

    const { data: nextFolio, error: folioError } = await supabaseAdmin.rpc("get_next_reimbursement_folio");
    if (folioError) {
      return new Response(JSON.stringify({ error: "No se pudo generar folio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("reimbursements")
      .insert({
        tenant_id: tenantId,
        user_id: null,
        type: "supplier_payment",
        status: "pending",
        supplier_name: supplierName,
        amount,
        subject,
        folio: nextFolio,
        account_info: {
          bank: String(formData?.bank ?? ""),
          account_type: String(formData?.account_type ?? ""),
          account_number: String(formData?.account_number ?? ""),
          holder_name: String(formData?.holder_name ?? ""),
          holder_rut: String(formData?.holder_rut ?? ""),
          supplier_rut: String(formData?.rut ?? ""),
          supplier_email: String(formData?.email ?? ""),
          supplier_phone: String(formData?.phone ?? ""),
          submitted_via: "signed_supplier_link",
        },
        attachments: attachmentUrls,
      })
      .select("id, folio")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: "No se pudo crear la solicitud" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, request_id: inserted.id, folio: inserted.folio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
