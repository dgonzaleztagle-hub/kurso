-- RPC SEGURO: Obtener usuarios por Tenant
-- Filtra estrictamente usuarios que pertenecen al tenant indicado.
-- Verifica que el solicitante sea Owner o Admin de ESE tenant.

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
    -- Hacemos JOIN con tenant_members para asegurar pertenencia
    SELECT json_build_object(
        'users', COALESCE(
            json_agg(
                json_build_object(
                    'id', au.id,
                    'role', tm.role,           -- Rol Específico del Tenant
                    'roleId', tm.id,           -- ID de la membresía (para borrar/editar)
                    'email', au.email,
                    'name', au.full_name,
                    'userName', NULL,          -- Legacy field, maybe not needed or join user_roles if needed
                    'position', NULL,          -- Legacy field
                    'phone', au.whatsapp_number, -- Usar número del perfil global
                    'displayName', us.display_name,
                    'studentId', us.student_id,
                    'studentLinkId', us.id
                )
            ),
            '[]'::json
        )
    ) INTO result
    FROM public.tenant_members tm
    JOIN public.app_users au ON tm.user_id = au.id
    LEFT JOIN public.user_students us ON tm.user_id = us.user_id AND us.tenant_id = target_tenant_id
    WHERE tm.tenant_id = target_tenant_id;

    RETURN result;
END;
$$;
