import {
  corsHeaders,
  createAdminClient,
  json,
  resolveActor,
} from "../_shared/supportTickets.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const actor = await resolveActor(supabaseAdmin, req.headers.get("Authorization"));

    if (!actor.userId) {
      return json({ error: "No autorizado" }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const status = String(payload?.status ?? "").trim();
    const visibilityMode = String(payload?.visibilityMode ?? "").trim();
    const tenantId = String(payload?.tenantId ?? "").trim();
    const search = String(payload?.search ?? "").trim().toLowerCase();

    const { data, error } = await supabaseAdmin
      .from("support_requests")
      .select(`
        id,
        created_at,
        request_type,
        status,
        subject,
        name,
        email,
        tenant_id,
        tenant_name,
        requester_user_id,
        requester_email_normalized,
        requester_role,
        assigned_owner_user_id,
        visibility_mode,
        last_message_at,
        resolved_at,
        source,
        external_reply_note,
        last_external_reply_at
      `)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const tickets = (data ?? []).filter((ticket) => {
      if (actor.isSuperadmin) {
        if (status && ticket.status !== status) return false;
        if (visibilityMode && ticket.visibility_mode !== visibilityMode) return false;
        if (tenantId && ticket.tenant_id !== tenantId) return false;
        if (search) {
          const haystack = [
            ticket.subject,
            ticket.name,
            ticket.email,
            ticket.tenant_name,
            ticket.request_type,
          ].join(" ").toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      }

      if (ticket.visibility_mode !== "authenticated_thread") {
        return false;
      }

      if (actor.role === "owner" || actor.role === "staff") {
        return Boolean(ticket.tenant_id && actor.tenantIds.includes(ticket.tenant_id));
      }

      if (actor.role === "guardian") {
        if (ticket.requester_user_id === actor.userId) {
          return true;
        }

        return Boolean(
          actor.email &&
          ticket.requester_email_normalized === actor.email &&
          (!ticket.tenant_id || actor.tenantIds.includes(ticket.tenant_id)),
        );
      }

      return false;
    });

    return json({ tickets });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
