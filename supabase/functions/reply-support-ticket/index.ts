import {
  canReplyInApp,
  corsHeaders,
  createAdminClient,
  json,
  nextStatusForReply,
  normalizeText,
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
    const body = normalizeText(payload?.body, 5000);

    if (!ticketId || !body) {
      return json({ error: "ticketId y body son requeridos" }, 400);
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("support_requests")
      .select("id, visibility_mode, tenant_id, requester_user_id, requester_email_normalized")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError) {
      throw ticketError;
    }

    if (!ticket) {
      return json({ error: "Ticket no encontrado" }, 404);
    }

    if (!canReplyInApp(actor, ticket)) {
      return json({ error: "No autorizado para responder este ticket" }, 403);
    }

    const authorRole = actor.isSuperadmin ? "superadmin" : actor.role;
    const now = new Date().toISOString();
    const nextStatus = nextStatusForReply(actor);

    const { data: messageRow, error: messageError } = await supabaseAdmin
      .from("support_request_messages")
      .insert({
        support_request_id: ticket.id,
        author_user_id: actor.userId,
        author_role: authorRole,
        body,
      })
      .select("id, created_at, author_user_id, author_role, body")
      .single();

    if (messageError) {
      throw messageError;
    }

    const { error: updateError } = await supabaseAdmin
      .from("support_requests")
      .update({
        status: nextStatus,
        last_message_at: now,
        resolved_at: null,
        resolved_by_user_id: null,
      })
      .eq("id", ticket.id);

    if (updateError) {
      throw updateError;
    }

    return json({
      success: true,
      ticketId: ticket.id,
      status: nextStatus,
      message: messageRow,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
