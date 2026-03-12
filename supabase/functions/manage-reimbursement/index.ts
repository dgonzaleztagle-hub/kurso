import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import {
  parseReimbursementActionPayload,
  type ParsedReimbursementAction,
} from "../_shared/reimbursementActions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReimbursementRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  type: string;
  status: string;
  amount: number;
  subject: string;
  folio: number | null;
};

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let payload: ParsedReimbursementAction;
    try {
      payload = parseReimbursementActionPayload(await req.json());
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Solicitud invalida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: reimbursement, error: reimbursementError } = await supabaseAdmin
      .from("reimbursements")
      .select("id, tenant_id, user_id, type, status, amount, subject, folio")
      .eq("id", payload.reimbursementId)
      .maybeSingle();

    if (reimbursementError || !reimbursement) {
      return new Response(
        JSON.stringify({ error: "Rendicion no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: appUser }, { data: ownerTenant }, { data: memberRole }] = await Promise.all([
      supabaseAdmin
        .from("app_users")
        .select("is_superadmin")
        .eq("id", callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("id", reimbursement.tenant_id)
        .eq("owner_id", callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", reimbursement.tenant_id)
        .eq("user_id", callerUser.id)
        .in("role", ["owner", "staff", "master", "admin"])
        .eq("status", "active")
        .maybeSingle(),
    ]);

    const canProcess = Boolean(appUser?.is_superadmin || ownerTenant || memberRole);
    if (!canProcess) {
      return new Response(
        JSON.stringify({ error: "No autorizado para gestionar rendiciones en este curso" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "approve") {
      const { data, error } = await supabaseAdmin.rpc("approve_reimbursement_transaction", {
        target_reimbursement_id: payload.reimbursementId,
        target_processed_by: callerUser.id,
        payment_proof_files: payload.paymentProof,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await notifyCreatorIfNeeded(supabaseAdmin, reimbursement as ReimbursementRow, "approved");

      return new Response(
        JSON.stringify({ success: true, result: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "reject") {
      const { data, error } = await supabaseAdmin.rpc("reject_reimbursement_transaction", {
        target_reimbursement_id: payload.reimbursementId,
        target_processed_by: callerUser.id,
        target_rejection_reason: payload.rejectionReason,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await notifyCreatorIfNeeded(supabaseAdmin, reimbursement as ReimbursementRow, "rejected", payload.rejectionReason ?? undefined);

      return new Response(
        JSON.stringify({ success: true, result: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "reopen") {
      const { data, error } = await supabaseAdmin.rpc("reopen_reimbursement_transaction", {
        target_reimbursement_id: payload.reimbursementId,
        target_processed_by: callerUser.id,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, result: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data, error } = await supabaseAdmin.rpc("delete_reimbursement_transaction", {
      target_reimbursement_id: payload.reimbursementId,
      target_processed_by: callerUser.id,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, result: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function notifyCreatorIfNeeded(
  supabaseAdmin: ReturnType<typeof createClient>,
  reimbursement: ReimbursementRow,
  status: "approved" | "rejected",
  rejectionReason?: string,
) {
  if (!reimbursement.user_id) {
    return;
  }

  const { data: creatorData } = await supabaseAdmin
    .from("user_roles")
    .select("phone, user_name, user_id")
    .eq("user_id", reimbursement.user_id)
    .maybeSingle();

  if (!creatorData?.phone) {
    return;
  }

  const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-reimbursement-notification`;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) {
    return;
  }

  await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      user_phone: creatorData.phone,
      user_name: creatorData.user_name,
      reimbursement_type: reimbursement.type,
      subject: reimbursement.subject,
      amount: reimbursement.amount,
      status,
      folio: reimbursement.folio,
      rejection_reason: rejectionReason,
      user_id: creatorData.user_id,
    }),
  });
}
