-- RPC SEGURO V2: Obtener usuarios por Tenant (Corrección de Columnas)
-- Filtra estrictamente usuarios que pertenecen al tenant indicado.
-- Verifica que el solicitante sea Owner o Admin de ESE tenant.
-- CORRECCIÓN: Hace JOIN con 'students' para filtrar por tenant_id correctamente.

CREATE OR REPLACE FUNCTION public.get_users_by_tenant(target_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    is_authorized boolean;
    result json;
BEGIN
    current_user_id := auth.uid();

    -- 1. Verificar Autorización: ¿Es el solicitante Owner o Admin de ESTE tenant?
    SELECT EXISTS (
        SELECT 1 FROM public.tenants 
        WHERE id = target_tenant_id AND owner_id = current_user_id
        UNION
        SELECT 1 FROM public.tenant_members 
        WHERE tenant_id = target_tenant_id 
          AND user_id = current_user_id 
          AND role IN ('owner', 'admin')
          AND status = 'active'
    ) INTO is_authorized;

    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You do not have permission to view users for this tenant.';
    END IF;

    -- 2. Obtener Usuarios DEL TENANT
    -- Usamos tenant_members como fuente de verdad.
    -- Hacemos LEFT JOIN con user_students Y students para traer info del alumno SOLO si pertenece a este tenant.
    SELECT json_build_object(
        'users', COALESCE(
            json_agg(
                json_build_object(
                    'id', au.id,
                    'role', tm.role,           
                    'roleId', tm.id,           
                    'email', au.email,
                    'name', au.full_name,
                    'userName', NULL,          
                    'position', NULL,          
                    'phone', au.whatsapp_number, 
                    'displayName', us.display_name,
                    'studentId', s.id,         -- ID real del estudiante (tabla students)
                    'studentLinkId', us.id,    -- ID del enlace
                    'studentName', s.first_name || ' ' || s.last_name -- Nombre real del alumno
                )
            ),
            '[]'::json
        )
    ) INTO result
    FROM public.tenant_members tm
    JOIN public.app_users au ON tm.user_id = au.id
    -- Join complejo para traer solo alumnos de ESTE tenant
    LEFT JOIN public.user_students us ON tm.user_id = us.user_id
    LEFT JOIN public.students s ON us.student_id = s.id AND s.tenant_id = target_tenant_id
    WHERE tm.tenant_id = target_tenant_id;

    RETURN result;
END;
$$;
