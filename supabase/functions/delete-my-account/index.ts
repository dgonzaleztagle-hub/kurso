import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function deletedEmailFor(userId: string) {
  return `deleted+${userId}@deleted.mikurso.cl`;
}

function normalizeRole(role?: string | null) {
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
      return role ?? null;
  }
}

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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: appUser }, { data: roleRow }, { data: ownerTenants }, { data: memberships }, { data: linkedStudents }] = await Promise.all([
      supabaseAdmin
        .from("app_users")
        .select("email, full_name, is_superadmin")
        .eq("id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("tenants")
        .select("id, name")
        .eq("owner_id", user.id),
      supabaseAdmin
        .from("tenant_members")
        .select("tenant_id, role, status")
        .eq("user_id", user.id),
      supabaseAdmin
        .from("user_students")
        .select("student_id")
        .eq("user_id", user.id),
    ]);

    const canonicalRole = normalizeRole(roleRow?.role ?? null);
    const activeOwnerTenants = (ownerTenants ?? []).filter(Boolean);

    if (appUser?.is_superadmin) {
      await supabaseAdmin.from("account_deletion_requests").insert({
        auth_user_id: user.id,
        email_before_deletion: appUser.email ?? user.email ?? null,
        role_before_deletion: canonicalRole,
        status: "blocked_superadmin",
        notes: "La cuenta superadmin debe eliminarse por canal administrativo controlado.",
        metadata: {
          memberships: memberships ?? [],
        },
      });

      return new Response(
        JSON.stringify({
          error: "Las cuentas de plataforma deben eliminarse por canal administrativo controlado.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (activeOwnerTenants.length > 0) {
      await supabaseAdmin.from("account_deletion_requests").insert({
        auth_user_id: user.id,
        tenant_id: activeOwnerTenants[0]?.id ?? null,
        email_before_deletion: appUser?.email ?? user.email ?? null,
        role_before_deletion: canonicalRole,
        status: "pending_owner_transfer",
        notes: "La cuenta owner debe transferir la propiedad del curso antes de eliminarse.",
        metadata: {
          ownerTenants: activeOwnerTenants,
          memberships: memberships ?? [],
        },
      });

      return new Response(
        JSON.stringify({
          error: "Debes transferir la propiedad del curso antes de eliminar tu cuenta.",
          requiresOwnershipTransfer: true,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requestInsert = await supabaseAdmin
      .from("account_deletion_requests")
      .insert({
        auth_user_id: user.id,
        tenant_id: memberships?.[0]?.tenant_id ?? null,
        email_before_deletion: appUser?.email ?? user.email ?? null,
        role_before_deletion: canonicalRole,
        status: "processing",
        metadata: {
          memberships: memberships ?? [],
          linkedStudents: linkedStudents ?? [],
        },
      })
      .select("id")
      .single();

    if (requestInsert.error) {
      throw requestInsert.error;
    }

    const deletionRequestId = requestInsert.data.id;
    const anonymizedEmail = deletedEmailFor(user.id);
    const isStudentStyleAccount = (appUser?.email ?? user.email ?? "").endsWith("@estudiantes.kurso");
    const studentIds = (linkedStudents ?? []).map((row) => row.student_id).filter(Boolean);

    const updates: Promise<unknown>[] = [
      supabaseAdmin
        .from("payment_notifications")
        .update({
          user_id: null,
          submitted_by: null,
          payer_name: "Cuenta eliminada",
        })
        .or(`user_id.eq.${user.id},submitted_by.eq.${user.id}`),
      supabaseAdmin
        .from("user_students")
        .update({ display_name: "Cuenta eliminada" })
        .eq("user_id", user.id),
      supabaseAdmin
        .from("tenant_members")
        .update({ status: "inactive" })
        .eq("user_id", user.id),
      supabaseAdmin
        .from("user_roles")
        .update({ first_login: false, user_name: "Cuenta eliminada" })
        .eq("user_id", user.id),
      supabaseAdmin
        .from("app_users")
        .update({
          email: anonymizedEmail,
          full_name: "Cuenta eliminada",
          whatsapp_number: null,
          avatar_url: null,
        })
        .eq("id", user.id),
      supabaseAdmin
        .from("support_requests")
        .update({
          email: anonymizedEmail,
          name: "Cuenta eliminada",
        })
        .eq("user_id", user.id),
    ];

    if (isStudentStyleAccount && studentIds.length > 0) {
      updates.push(
        supabaseAdmin
          .from("students")
          .update({ rut: null })
          .in("id", studentIds),
      );
    }

    const updateResults = await Promise.all(updates);
    const failedUpdate = updateResults.find((result) => {
      const candidate = result as { error?: { message?: string } };
      return candidate?.error;
    }) as { error?: { message?: string } } | undefined;

    if (failedUpdate?.error) {
      await supabaseAdmin
        .from("account_deletion_requests")
        .update({
          status: "failed_data_cleanup",
          notes: failedUpdate.error.message ?? "Error en limpieza/anonymizacion de datos",
        })
        .eq("id", deletionRequestId);

      throw new Error(failedUpdate.error.message ?? "No se pudo anonimizar la cuenta");
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      await supabaseAdmin
        .from("account_deletion_requests")
        .update({
          status: "failed_auth_delete",
          notes: deleteAuthError.message,
        })
        .eq("id", deletionRequestId);

      throw deleteAuthError;
    }

    await supabaseAdmin
      .from("account_deletion_requests")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        notes: "Cuenta anonimizada y acceso de autenticacion eliminado.",
      })
      .eq("id", deletionRequestId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Tu cuenta fue eliminada y tus datos personales fueron anonimizados cuando correspondia.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
