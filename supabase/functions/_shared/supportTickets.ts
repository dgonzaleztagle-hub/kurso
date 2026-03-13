import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type CanonicalRole = "superadmin" | "owner" | "staff" | "guardian" | "public";

export type SupportActor = {
  userId: string | null;
  email: string | null;
  role: CanonicalRole;
  tenantIds: string[];
  isSuperadmin: boolean;
};

export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRole(role?: string | null): Exclude<CanonicalRole, "superadmin" | "public"> | null {
  switch (role) {
    case "owner":
    case "master":
      return "owner";
    case "staff":
    case "admin":
      return "staff";
    case "guardian":
    case "alumnos":
    case "student":
    case "member":
      return "guardian";
    default:
      return null;
  }
}

export async function resolveActor(supabaseAdmin: SupabaseClient, authHeader: string | null): Promise<SupportActor> {
  if (!authHeader) {
    return {
      userId: null,
      email: null,
      role: "public",
      tenantIds: [],
      isSuperadmin: false,
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error("No autorizado");
  }

  const [{ data: appUser }, { data: ownerTenants }, { data: memberships }, { data: roleRow }] = await Promise.all([
    supabaseAdmin.from("app_users").select("email, is_superadmin").eq("id", user.id).maybeSingle(),
    supabaseAdmin.from("tenants").select("id").eq("owner_id", user.id),
    supabaseAdmin.from("tenant_members").select("tenant_id, role, status").eq("user_id", user.id).eq("status", "active"),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  const tenantIds = new Set<string>();
  for (const tenant of ownerTenants ?? []) {
    if (tenant?.id) tenantIds.add(tenant.id);
  }
  for (const member of memberships ?? []) {
    if (member?.tenant_id) tenantIds.add(member.tenant_id);
  }

  const isSuperadmin = Boolean(appUser?.is_superadmin);
  let role: CanonicalRole = "guardian";

  if (isSuperadmin) {
    role = "superadmin";
  } else if ((ownerTenants ?? []).length > 0) {
    role = "owner";
  } else {
    const membershipRole = normalizeRole((memberships ?? [])[0]?.role ?? null);
    const fallbackRole = normalizeRole(roleRow?.role ?? null);
    role = membershipRole ?? fallbackRole ?? "guardian";
  }

  return {
    userId: user.id,
    email: (appUser?.email ?? user.email ?? "").toLowerCase() || null,
    role,
    tenantIds: [...tenantIds],
    isSuperadmin,
  };
}

export function canAccessTicket(actor: SupportActor, ticket: {
  visibility_mode: string | null;
  tenant_id: string | null;
  requester_user_id: string | null;
  requester_email_normalized: string | null;
}) {
  if (actor.isSuperadmin) {
    return true;
  }

  if (ticket.visibility_mode !== "authenticated_thread") {
    return false;
  }

  if (actor.role === "owner" || actor.role === "staff") {
    return Boolean(ticket.tenant_id && actor.tenantIds.includes(ticket.tenant_id));
  }

  if (actor.role === "guardian") {
    if (ticket.requester_user_id && ticket.requester_user_id === actor.userId) {
      return true;
    }

    if (
      actor.email &&
      ticket.requester_email_normalized === actor.email &&
      (!ticket.tenant_id || actor.tenantIds.includes(ticket.tenant_id))
    ) {
      return true;
    }
  }

  return false;
}

export function canReplyInApp(actor: SupportActor, ticket: {
  visibility_mode: string | null;
  tenant_id: string | null;
  requester_user_id: string | null;
  requester_email_normalized: string | null;
}) {
  return ticket.visibility_mode === "authenticated_thread" && canAccessTicket(actor, ticket);
}

export function nextStatusForReply(actor: SupportActor) {
  return actor.isSuperadmin ? "waiting_course" : "waiting_superadmin";
}
