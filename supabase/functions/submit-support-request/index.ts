import {
  corsHeaders,
  createAdminClient,
  isValidEmail,
  json,
  normalizeText,
  resolveActor,
} from "../_shared/supportTickets.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const actor = await resolveActor(supabaseAdmin, req.headers.get("Authorization"));
    const payload = await req.json().catch(() => ({}));

    const name = normalizeText(payload?.name, 120);
    const payloadEmail = normalizeText(payload?.email, 160).toLowerCase();
    const email = actor.email ?? payloadEmail;
    const subject = normalizeText(payload?.subject, 160);
    const message = normalizeText(payload?.message, 5000);
    const requestType = normalizeText(payload?.requestType, 64) || "support";
    const source = normalizeText(payload?.source, 32) || "web";
    const requestedTenantId = normalizeText(payload?.tenantId, 64) || null;
    const tenantNameFromPayload = normalizeText(payload?.tenantName, 160) || null;

    if (!name || !email || !subject || !message) {
      return json({ error: "Nombre, email, asunto y mensaje son requeridos" }, 400);
    }

    if (!isValidEmail(email)) {
      return json({ error: "Debes ingresar un correo valido" }, 400);
    }

    if (!VALID_REQUEST_TYPES.has(requestType)) {
      return json({ error: "Tipo de solicitud no soportado" }, 400);
    }

    let tenantId: string | null = null;
    let tenantName: string | null = tenantNameFromPayload;
    let assignedOwnerUserId: string | null = null;
    let visibilityMode: "authenticated_thread" | "public_email_only" = actor.userId
      ? "authenticated_thread"
      : "public_email_only";

    if (requestedTenantId) {
      const { data: tenantRow } = await supabaseAdmin
        .from("tenants")
        .select("id, name, owner_id")
        .eq("id", requestedTenantId)
        .maybeSingle();

      if (tenantRow) {
        const actorCanUseTenant = actor.isSuperadmin || actor.tenantIds.includes(tenantRow.id);
        if (actor.userId && !actorCanUseTenant) {
          return json({ error: "No autorizado para abrir tickets en ese curso" }, 403);
        }

        tenantId = tenantRow.id;
        tenantName = tenantRow.name ?? tenantName;
        assignedOwnerUserId = tenantRow.owner_id ?? null;
      }
    }

    const requesterRole = actor.isSuperadmin ? "superadmin" : actor.userId ? actor.role : "public";

    const insertPayload = {
      request_type: requestType,
      status: "open",
      name,
      email,
      subject,
      message,
      source,
      tenant_id: tenantId,
      tenant_name: tenantName,
      user_id: actor.userId,
      requester_user_id: actor.userId,
      requester_email_normalized: email.toLowerCase(),
      requester_role: requesterRole,
      assigned_owner_user_id: assignedOwnerUserId,
      visibility_mode: visibilityMode,
      last_message_at: new Date().toISOString(),
      metadata: {
        path: req.headers.get("origin") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    };

    const { data: ticket, error: insertError } = await supabaseAdmin
      .from("support_requests")
      .insert(insertPayload)
      .select("id, created_at, status, visibility_mode")
      .single();

    if (insertError) {
      throw insertError;
    }

    if (visibilityMode === "authenticated_thread" && actor.userId) {
      const { error: messageError } = await supabaseAdmin.from("support_request_messages").insert({
        support_request_id: ticket.id,
        author_user_id: actor.userId,
        author_role: requesterRole,
        body: message,
      });

      if (messageError) {
        throw messageError;
      }
    }

    return json({
      success: true,
      ticketId: ticket.id,
      visibilityMode: ticket.visibility_mode,
      status: ticket.status,
      followUpChannel: visibilityMode === "authenticated_thread" ? "in_app" : "email_manual",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
