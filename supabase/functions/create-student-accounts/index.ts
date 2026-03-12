import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
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

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId;
    const studentId = body?.studentId;
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
        .in("role", ["owner", "master", "admin"])
        .eq("status", "active")
        .maybeSingle(),
    ]);

    const canManage = Boolean(appUser?.is_superadmin || ownerTenant || memberRole);
    if (!canManage) {
      return new Response(
        JSON.stringify({ error: "No autorizado para generar cuentas en este curso" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let studentsQuery = supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, rut, tenant_id")
      .eq("tenant_id", tenantId)
      .order("last_name");

    if (studentId) {
      studentsQuery = studentsQuery.eq("id", studentId);
    }

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) throw studentsError;

    const results: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];

    for (const student of students ?? []) {
      const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
      if (!student.rut) {
        results.push({ student: fullName, status: "skipped", reason: "Sin RUT" });
        continue;
      }

      const cleanRut = String(student.rut).replace(/[^0-9kK]/g, "").toUpperCase();
      const rutBody = cleanRut.slice(0, -1);
      const email = `${rutBody}@estudiantes.kurso`;
      const pwd = rutBody.length >= 6 ? rutBody.substring(0, 6) : (rutBody.length >= 4 ? rutBody.substring(0, 4) : "123456");

      const { data: existingLink } = await supabaseAdmin
        .from("user_students")
        .select("id")
        .eq("student_id", student.id)
        .maybeSingle();
      if (existingLink) {
        results.push({ student: fullName, status: "skipped", reason: "Ya vinculado" });
        continue;
      }

      let userId: string | null = null;

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: pwd,
        email_confirm: true,
        user_metadata: { full_name: fullName, rut: student.rut },
      });

      if (createError) {
        if ((createError.message || "").toLowerCase().includes("already")) {
          const { data: existingProfile } = await supabaseAdmin
            .from("app_users")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          userId = existingProfile?.id ?? null;
        } else {
          errors.push({ student: fullName, email, error: createError.message });
          continue;
        }
      } else {
        userId = created.user?.id ?? null;
      }

      if (!userId) {
        errors.push({ student: fullName, email, error: "No se pudo resolver userId" });
        continue;
      }

      await supabaseAdmin.from("tenant_members").upsert({
        tenant_id: tenantId,
        user_id: userId,
        role: "alumnos",
        status: "active",
      }, { onConflict: "tenant_id,user_id" });

      await supabaseAdmin.from("user_roles").upsert({
        user_id: userId,
        role: "alumnos",
      }, { onConflict: "user_id" });

      const { error: linkError } = await supabaseAdmin
        .from("user_students")
        .upsert({
          user_id: userId,
          student_id: student.id,
          display_name: fullName,
        }, { onConflict: "user_id,student_id" });

      if (linkError) {
        errors.push({ student: fullName, email, error: linkError.message });
        continue;
      }

      results.push({ student: fullName, email, status: "created_or_linked" });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: students?.length ?? 0,
        processed: results.length + errors.length,
        created: results.filter((r) => r.status === "created_or_linked").length,
        linked: results.filter((r) => r.status === "skipped").length,
        failed: errors.length,
        results,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
