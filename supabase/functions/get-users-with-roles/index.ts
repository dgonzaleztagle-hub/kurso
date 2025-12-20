import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Cliente con service role para operaciones administrativas
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

    // MODO PRUEBA: Verificación de autenticación deshabilitada temporalmente
    console.log('MODO PRUEBA: Ejecutando sin verificación de autenticación')
    
    /*
    // Verificar token del usuario
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verificar el JWT usando el service role
    let userId: string
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      userId = payload.sub

      if (!userId) {
        throw new Error('Invalid token')
      }
    } catch (error) {
      console.error('Token decode error:', error)
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar rol master u owner
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    let isAuthorized = false;

    // 1. Check Global Master/Admin
    if (roleData?.role === 'master' || roleData?.role === 'admin') {
      isAuthorized = true;
    } else {
      // 2. Check if Tenant Owner (Direct)
      const { data: ownedTenants } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('owner_id', userId)
        .limit(1);

      if (ownedTenants && ownedTenants.length > 0) {
        isAuthorized = true;
      } else {
        // 3. Check if Tenant Owner (Member)
        const { data: memberOwner } = await supabaseAdmin
          .from('tenant_members')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'owner')
          .limit(1);

        if (memberOwner && memberOwner.length > 0) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Solo usuarios Master u Owner pueden ver esta información' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    */

    // Obtener todos los roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('*')

    if (rolesError) throw rolesError

    // Obtener vínculos con estudiantes
    const { data: studentLinks, error: linksError } = await supabaseAdmin
      .from('user_students')
      .select('*')

    if (linksError) throw linksError

    // Obtener información de usuarios desde auth
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers()

    if (authUsersError) throw authUsersError

    // Combinar la información
    const usersWithRoles = (roles || []).map(role => {
      const authUser = authUsers.users.find(u => u.id === role.user_id)
      const studentLink = (studentLinks || []).find(l => l.user_id === role.user_id)

      return {
        id: role.user_id,
        role: role.role,
        roleId: role.id,
        email: authUser?.email || 'Email no disponible',
        name: authUser?.user_metadata?.name || null,
        userName: role.user_name || null,
        position: role.position || null,
        displayName: studentLink?.display_name || null,
        studentId: studentLink?.student_id,
        studentLinkId: studentLink?.id
      }
    })

    return new Response(
      JSON.stringify({ users: usersWithRoles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
