-- ==============================================================================
-- REFRESH RPC: GET USERS BY TENANT
-- ==============================================================================
-- Asegura que la función que lista usuarios busque en 'tenant_members'
-- y no en tablas antiguas.

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
    -- (O está en la lista de miembros como owner, o es el creador del tenant)
    SELECT EXISTS (
        SELECT 1 FROM public.tenants 
        WHERE id = target_tenant_id AND owner_id = current_user_id
        UNION
        SELECT 1 FROM public.tenant_members 
        WHERE tenant_id = target_tenant_id 
          AND user_id = current_user_id 
          AND role = 'owner'
          AND status = 'active'
    ) INTO is_authorized;

    IF NOT is_authorized THEN
        -- Si falla, devolvemos array vacío en vez de error para no romper la UI,
        -- o lanzamos error si preferimos. Por ahora, error claro.
        RAISE EXCEPTION 'Access Denied: You are not an Owner of this tenant.';
    END IF;

    -- 2. Obtener Usuarios DEL TENANT
    -- Usamos tenant_members como la ÚNICA fuente de verdad.
    SELECT json_build_object(
        'users', COALESCE(
            json_agg(
                json_build_object(
                    'id', au.id,
                    'role', tm.role,           
                    'roleId', tm.id,           
                    'email', au.email,
                    'name', au.full_name,
                    -- Campos opcionales que podrían venir de metadata si existieran
                    'phone', au.whatsapp_number, 
                    'createdAt', tm.created_at
                ) ORDER BY tm.created_at DESC
            ),
            '[]'::json
        )
    ) INTO result
    FROM public.tenant_members tm
    JOIN public.app_users au ON tm.user_id = au.id
    WHERE tm.tenant_id = target_tenant_id;

    RETURN result;
END;
$$;
