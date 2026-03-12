import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import { canManageParentUsers } from "../_shared/parentUserPermissions.ts";

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
        JSON.stringify({ error: "Falta header de autorización" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "No autorizado / Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { email, password, displayName, studentId, tenantId } = await req.json();

    if (!email || !password || !studentId || !tenantId) {
      return new Response(
        JSON.stringify({ error: "email, password, studentId y tenantId son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (String(password).length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: appUser }, { data: ownerTenant }, { data: memberRole }, { data: studentRow, error: studentError }] = await Promise.all([
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
        .in("role", ["owner", "master", "admin"])
        .eq("status", "active")
        .maybeSingle(),
      supabaseAdmin
        .from("students")
        .select("id, first_name, last_name, tenant_id")
        .eq("id", studentId)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

    if (studentError || !studentRow) {
      return new Response(
        JSON.stringify({ error: "El alumno no pertenece al curso indicado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const canManageParents = canManageParentUsers({
      isSuperadmin: appUser?.is_superadmin,
      ownsTenant: Boolean(ownerTenant),
      tenantRole: memberRole?.role ?? null,
    });
    if (!canManageParents) {
      return new Response(
        JSON.stringify({ error: "No autorizado para crear apoderados en este tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const studentFullName = `${studentRow.first_name ?? ""} ${studentRow.last_name ?? ""}`.trim() || "Alumno";
    const resolvedDisplayName = String(displayName || "").trim() || `Apoderado de ${studentFullName}`;

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: resolvedDisplayName,
      },
    });

    if (createError || !createdUser.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || "No se pudo crear el usuario" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const newUserId = createdUser.user.id;

    const { error: appUserError } = await supabaseAdmin
      .from("app_users")
      .upsert({
        id: newUserId,
        email,
        full_name: resolvedDisplayName,
        is_superadmin: false,
      });

    if (appUserError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: appUserError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: memberError } = await supabaseAdmin
      .from("tenant_members")
      .insert({
        tenant_id: tenantId,
        user_id: newUserId,
        role: "alumnos",
        status: "active",
      });

    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: `Error al asignar membresía: ${memberError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: newUserId,
        role: "alumnos",
        first_login: true,
        user_name: resolvedDisplayName,
      }, { onConflict: "user_id" });

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: `Error al asignar rol legacy: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: linkError } = await supabaseAdmin
      .from("user_students")
      .insert({
        user_id: newUserId,
        student_id: studentId,
        display_name: resolvedDisplayName,
      });

    if (linkError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: `Error al vincular apoderado: ${linkError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUserId,
          email,
          displayName: resolvedDisplayName,
          studentId,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
