import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    let tenantId = new URL(req.url).searchParams.get("tenantId");
    if (!tenantId) {
      try {
        const body = await req.json();
        tenantId = body?.tenantId ?? null;
      } catch {
        tenantId = null;
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "tenantId es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        .eq("id", tenantId)
        .eq("owner_id", callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", tenantId)
        .eq("user_id", callerUser.id)
        .in("role", ["owner", "staff", "master", "admin"])
        .eq("status", "active")
        .maybeSingle(),
    ]);

    const canReadUsers = Boolean(appUser?.is_superadmin || ownerTenant || memberRole);
    if (!canReadUsers) {
      return new Response(
        JSON.stringify({ error: "No autorizado para ver usuarios de este curso" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("tenant_members")
      .select("user_id, role")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (membersError) throw membersError;

    const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ users: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: roles }, { data: studentLinks }, authUsersResponse] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("*")
        .in("user_id", userIds),
      supabaseAdmin
        .from("user_students")
        .select("*")
        .in("user_id", userIds),
      supabaseAdmin.auth.admin.listUsers(),
    ]);

    if (authUsersResponse.error) throw authUsersResponse.error;
    const authUsers = authUsersResponse.data.users;

    const usersWithRoles = userIds.map((userId) => {
      const member = members?.find((m) => m.user_id === userId);
      const role = roles?.find((r) => r.user_id === userId);
      const authUser = authUsers.find((u) => u.id === userId);
      const studentLink = studentLinks?.find((l) => l.user_id === userId);

      return {
        id: userId,
        role: role?.role ?? member?.role ?? "guardian",
        roleId: role?.id ?? null,
        email: authUser?.email || "Email no disponible",
        name: authUser?.user_metadata?.name || authUser?.user_metadata?.full_name || null,
        userName: role?.user_name || null,
        position: role?.position || null,
        displayName: studentLink?.display_name || null,
        studentId: studentLink?.student_id ?? null,
        studentLinkId: studentLink?.id ?? null,
      };
    });

    return new Response(
      JSON.stringify({ users: usersWithRoles }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
