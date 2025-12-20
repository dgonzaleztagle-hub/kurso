import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    );

    // MODO PRUEBA: Verificación de autenticación deshabilitada temporalmente
    // Para reactivar, descomentar el bloque de verificación abajo
    
    /*
    // Verificar que el usuario que hace la petición sea master
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar rol master
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'master')
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Solo usuarios master pueden crear cuentas masivas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    */
    
    console.log('MODO PRUEBA: Ejecutando sin verificación de autenticación');

    // Obtener todos los estudiantes (ahora incluyendo RUT via select *)
    // Nota: Como 'rut' es columna nueva, asegurarse que la migración se corrió.
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, name, rut')
      .order('name');

    if (studentsError) {
      throw studentsError;
    }

    const results = [];
    const errors = [];

    for (const student of students || []) {
      try {
        if (!student.rut) {
          console.log(`Estudiante ${student.name} no tiene RUT, saltando...`);
          results.push({
            student: student.name,
            status: 'skipped',
            reason: 'Sin RUT registrado'
          });
          continue;
        }

        // Limpiar RUT para generar credenciales
        // Formato esperado en BD: 12345678-9 (o similar)
        const cleanRut = student.rut.replace(/[^0-9kK]/g, "").toUpperCase();

        // Separar cuerpo (todo menos el último caracter)
        const rutBody = cleanRut.slice(0, -1);

        // Email: 12345678@kurso.cl
        const email = `${rutBody}@kurso.cl`;

        // Password: Primeros 4 dígitos del RUT (o el cuerpo completo si es corto)
        const password = rutBody.length > 4 ? rutBody.substring(0, 4) : rutBody;

        // Fallback inseguro si el RUT es demasiado corto (ej: 1-9) -> '123456'
        const finalPassword = password.length < 4 ? '123456' : password;

        console.log(`Procesando cuenta para ${student.name} (RUT: ${student.rut}) -> Email: ${email}`);

        // Verificar si ya existe un usuario vinculado a este estudiante
        const { data: existingLink } = await supabaseAdmin
          .from('user_students')
          .select('id')
          .eq('student_id', student.id)
          .maybeSingle();

        if (existingLink) {
          // Ya tiene usuario. ¿Validamos si es el correcto? 
          // Por ahora solo saltamos para no duplicar.
          results.push({
            student: student.name,
            email,
            status: 'skipped',
            reason: 'Ya tiene cuenta vinculada'
          });
          continue;
        }

        // Buscar si el usuario Auth YA existe (por ejemplo, creado en otro tenant o manualmente)
        const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
        // Nota: listUsers paginado por defecto es 50. Si hay mas, esto fallara en encontrarlo.
        // Mejor usar getUserByEmail si existiera en admin api... listUsers no tiene filtro server side fiable publico a veces.
        // Pero supabaseAdmin.auth.admin.createUser fallara si existe.

        let userId: string;
        let createdNew = false;

        // Intentar crear usuario
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: finalPassword,
          email_confirm: true,
          user_metadata: {
            full_name: student.name,
            rut: student.rut
          }
        });

        if (createError) {
          // Si el error es "User already registered", buscamos su ID para vincularlo
          // (Asumimos que es la misma persona porque usamos el RUT como ID único)
          if (createError.message?.includes("already registered") || createError.message?.includes("unique constraint")) {
            console.log(`Usuario ${email} ya existe en Auth, recuperando ID...`);

            // WARNING: No hay "getUserByEmail" directo en Admin API de JS standard expuesto facil sin listar.
            // Pero podemos intentar un truco: listUsers con filtro? No.
            // Como es Edge Function, podemos hacer query a auth.users direct si tuvieramos acceso SQL client?
            // No, usamos supabaseAdmin (REST).
            // Solución: Seguir "listUsers" strategy o asumir falla.
            // PERO: Si ya existe, es probable que sea el mismo.
            // Vamos a intentar obtenerlo de `public.app_users` si es que se replicó.

            const { data: existingAppUser } = await supabaseAdmin
              .from('app_users')
              .select('id')
              .eq('email', email)
              .single();

            if (existingAppUser) {
              userId = existingAppUser.id;
              console.log(`Usuario encontrado en app_users: ${userId}`);
            } else {
              // Si no esta en app_users pero si en Auth... caso raro de desincronizacion.
              // Probablemente necesitamos "listar usuarios" filtrando.
              // O saltar.
              errors.push({
                student: student.name,
                email,
                error: "Usuario Auth existe pero no se pudo recuperar ID (posible desincronización)"
              });
              continue;
            }
          } else {
            console.error(`Error creando usuario para ${student.name}:`, createError);
            errors.push({
              student: student.name,
              email,
              error: createError.message
            });
            continue;
          }
        } else {
          userId = newUser.user.id;
          createdNew = true;
        }

        // Si llegamos aqui, tenemos userId.

        // 1. Asegurar entrada en app_users (Trigger lo hace, pero si ya existia quizas falta update)
        // Opcional.

        // 2. Asignar rol alumnos
        const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'alumnos'
          });

        // Ignore error if role already exists (duplicate key)
        if (roleInsertError && !roleInsertError.message.includes('unique constraint') && !roleInsertError.message.includes('duplicate key')) {
          console.error(`Error asignando rol a ${student.name}:`, roleInsertError);
          // No borramos usuario porque puede ser compartido
          errors.push({
            student: student.name,
            email,
            error: 'Error asignando rol: ' + roleInsertError.message
          });
          continue;
        }

        // 3. Vincular con estudiante (Tabla user_students)
        const { error: linkError } = await supabaseAdmin
          .from('user_students')
          .insert({
            user_id: userId,
            student_id: student.id,
            display_name: student.name // Nombre del alumno como display
          });

        if (linkError) {
          console.error(`Error vinculando estudiante ${student.name}:`, linkError);
          errors.push({
            student: student.name,
            email,
            error: 'Error vinculando estudiante: ' + linkError.message
          });
          continue;
        }

        console.log(`Cuenta ${createdNew ? 'creada' : 'vinculada'} exitosamente para ${student.name}`);
        results.push({
          student: student.name,
          email,
          status: createdNew ? 'created' : 'linked'
        });

      } catch (error: any) {
        console.error(`Error procesando ${student.name}:`, error);
        errors.push({
          student: student.name,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: results.filter(r => r.status === 'created').length,
        linked: results.filter(r => r.status === 'linked').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: errors.length,
        results,
        errors
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error en create-student-accounts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
