import {
  canAccessTicket,
  corsHeaders,
  createAdminClient,
  json,
  normalizeText,
  resolveActor,
} from "../_shared/supportTickets.ts";

const VALID_STATUSES = new Set([
  "open",
  "waiting_course",
  "waiting_superadmin",
  "resolved",
  "closed",
]);

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
    const status = String(payload?.status ?? "").trim();
    const externalReplyNote = normalizeText(payload?.externalReplyNote, 2000) || null;

    if (!ticketId || !VALID_STATUSES.has(status)) {
      return json({ error: "ticketId y status valido son requeridos" }, 400);
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

    if (!canAccessTicket(actor, ticket)) {
      return json({ error: "No autorizado para actualizar este ticket" }, 403);
    }

    if (!actor.isSuperadmin && !["open", "resolved"].includes(status)) {
      return json({ error: "Solo superadmin puede aplicar ese estado" }, 403);
    }

    const patch: Record<string, unknown> = {
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
      resolved_by_user_id: status === "resolved" ? actor.userId : null,
    };

    if (actor.isSuperadmin && externalReplyNote) {
      patch.external_reply_note = externalReplyNote;
      patch.last_external_reply_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("support_requests")
      .update(patch)
      .eq("id", ticket.id);

    if (updateError) {
      throw updateError;
    }

    return json({
      success: true,
      ticketId: ticket.id,
      status,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
