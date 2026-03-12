import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar autorización básica del usuario llamante
    const authHeader = req.headers.get('Authorization')!
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Falta header de autorización' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'No autorizado / Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener datos del cuerpo
    const { email, password, name, userName, position, phone, tenantId } = await req.json()

    if (!email || !password || !userName) {
      return new Response(
        JSON.stringify({ error: 'Email, contraseña y nombre de usuario son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId es requerido para asignar el usuario' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar formato de teléfono si se proporcionó
    if (phone && !phone.startsWith('+')) {
      return new Response(
        JSON.stringify({ error: 'El teléfono debe estar en formato internacional (ej: +56912345678)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Permisos: solo owner/superadmin pueden crear staff en el tenant
    const [{ data: appUser }, { data: ownerTenant }, { data: memberRole }] = await Promise.all([
      supabaseAdmin
        .from('app_users')
        .select('is_superadmin')
        .eq('id', callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .eq('owner_id', callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from('tenant_members')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', callerUser.id)
        .eq('role', 'owner')
        .eq('status', 'active')
        .maybeSingle()
    ])

    const canManageStaff = Boolean(appUser?.is_superadmin || ownerTenant || memberRole)
    if (!canManageStaff) {
      return new Response(
        JSON.stringify({ error: 'No autorizado para crear staff en este tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Crear el usuario en Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name || userName,
        user_name: userName, // Legacy support in metadata
        phone: phone
      }
    })

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Error interno al crear usuario (Auth)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Crear entrada en app_users (Perfil público)
    // Usamos upsert para asegurar que exista
    const { error: profileError } = await supabaseAdmin
      .from('app_users')
      .upsert({
        id: newUser.user.id,
        email: email,
        full_name: name || userName,
        whatsapp_number: phone || null,
        is_superadmin: false
      })

    if (profileError) {
      console.error("Error creating app_user profile:", profileError)
      // No fallamos fatalmente aquí, pero es bueno loguearlo
    }

    // 3. Asignar membresía al Tenant con rol canónico
    const { error: memberError } = await supabaseAdmin
      .from('tenant_members')
      .insert({
        tenant_id: tenantId,
        user_id: newUser.user.id,
        role: 'staff',
        status: 'active'
      })

    if (memberError) {
      // Si falla la asignación, borramos el usuario para no dejar basura
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)

      return new Response(
        JSON.stringify({
          error: 'Error al asignar membresía (tenant_members): ' + memberError.message,
          details: memberError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Compatibilidad: user_roles sigue usándose para first_login y metadatos
    try {
      await supabaseAdmin.from('user_roles').insert({
        user_id: newUser.user.id,
        role: 'staff',
        user_name: userName,
        position: position,
        phone: phone || null
      })
    } catch (e) {
      console.warn("Legacy user_roles insert failed ignored", e)
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          name: name
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
