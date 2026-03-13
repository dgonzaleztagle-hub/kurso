import {
  canAccessTicket,
  canReplyInApp,
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
    const ticketId = String(payload?.ticketId ?? "").trim();

    if (!ticketId) {
      return json({ error: "ticketId es requerido" }, 400);
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("support_requests")
      .select(`
        id,
        created_at,
        request_type,
        status,
        subject,
        name,
        email,
        message,
        tenant_id,
        tenant_name,
        requester_user_id,
        requester_email_normalized,
        requester_role,
        assigned_owner_user_id,
        visibility_mode,
        last_message_at,
        resolved_at,
        resolved_by_user_id,
        source,
        external_reply_note,
        last_external_reply_at
      `)
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError) {
      throw ticketError;
    }

    if (!ticket) {
      return json({ error: "Ticket no encontrado" }, 404);
    }

    if (!canAccessTicket(actor, ticket)) {
      return json({ error: "No autorizado para ver este ticket" }, 403);
    }

    let messages: unknown[] = [];
    if (ticket.visibility_mode === "authenticated_thread") {
      const { data: threadRows, error: threadError } = await supabaseAdmin
        .from("support_request_messages")
        .select("id, created_at, author_user_id, author_role, body")
        .eq("support_request_id", ticket.id)
        .order("created_at", { ascending: true });

      if (threadError) {
        throw threadError;
      }

      messages = threadRows ?? [];
    }

    return json({
      ticket,
      messages,
      canReplyInApp: canReplyInApp(actor, ticket),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
