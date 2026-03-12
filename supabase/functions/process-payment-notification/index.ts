import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import {
  buildApprovalEntries,
  type PaymentDetails,
  type PaymentNotificationRow,
} from "../_shared/paymentNotificationEntries.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationRow = {
  id: string;
  tenant_id: string;
  student_id: number | null;
  payment_date: string;
  amount: number;
  status: string;
  payment_details: PaymentDetails;
  students?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
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

    const { notificationId, action, rejectionReason } = await req.json();
    if (!notificationId || !action) {
      return new Response(
        JSON.stringify({ error: "notificationId y action son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: notification, error: notificationError } = await supabaseAdmin
      .from("payment_notifications")
      .select(`
        id,
        tenant_id,
        student_id,
        payment_date,
        amount,
        status,
        payment_details,
        students (
          first_name,
          last_name
        )
      `)
      .eq("id", notificationId)
      .maybeSingle();

    if (notificationError || !notification) {
      return new Response(
        JSON.stringify({ error: "Notificación no encontrada" }),
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
        .eq("id", notification.tenant_id)
        .eq("owner_id", callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", notification.tenant_id)
        .eq("user_id", callerUser.id)
        .in("role", ["owner", "staff", "master", "admin"])
        .eq("status", "active")
        .maybeSingle(),
    ]);

    const canProcess = Boolean(appUser?.is_superadmin || ownerTenant || memberRole);
    if (!canProcess) {
      return new Response(
        JSON.stringify({ error: "No autorizado para procesar pagos en este curso" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "approve") {
      const paymentEntries = buildApprovalEntries(notification as PaymentNotificationRow);
      if (paymentEntries.length === 0) {
        return new Response(
          JSON.stringify({ error: "La notificación no contiene pagos aplicables" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data, error } = await supabaseAdmin.rpc("approve_payment_notification_transaction", {
        target_notification_id: notificationId,
        payment_entries: paymentEntries,
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

    if (action === "reject") {
      if (!String(rejectionReason || "").trim()) {
        return new Response(
          JSON.stringify({ error: "Debe indicar el motivo del rechazo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data, error } = await supabaseAdmin.rpc("reject_payment_notification_transaction", {
        target_notification_id: notificationId,
        target_processed_by: callerUser.id,
        target_rejection_reason: String(rejectionReason).trim(),
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

    return new Response(
      JSON.stringify({ error: "Acción no soportada" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
