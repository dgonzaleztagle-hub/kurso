-- ==============================================================================
-- FIX GHOST USERS & ROBUST LISTING
-- ==============================================================================

-- 1. Actualizar RPC para ser tolerante a fallos (LEFT JOIN)
CREATE OR REPLACE FUNCTION public.get_users_by_tenant(target_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'users', COALESCE(
            json_agg(
                json_build_object(
                    'id', tm.user_id,          -- Usar ID de member por seguridad
                    'role', tm.role,           
                    'roleId', tm.id,           
                    'email', au.email,         -- Puede ser NULL si falla el join
                    'name', COALESCE(au.full_name, 'Usuario Sin Perfil'),
                    'phone', au.whatsapp_number,
                    'createdAt', tm.created_at
                ) ORDER BY tm.created_at DESC
            ),
            '[]'::json
        )
    ) INTO result
    FROM public.tenant_members tm
    LEFT JOIN public.app_users au ON tm.user_id = au.id -- LEFT JOIN revela "Fantasmas"
    WHERE tm.tenant_id = target_tenant_id;

    RETURN result;
END;
$$;

-- 2. REPARACIÓN AUTOMÁTICA DE "FANTASMAS"
-- Si existen en Auth pero no en app_users, crearlos ahora mismo.

INSERT INTO public.app_users (id, email, full_name, created_at, updated_at)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Usuario Recuperado'),
    created_at,
    NOW()
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM public.app_users WHERE app_users.id = auth.users.id
);

-- 3. Verificación de Tenant Members (Opcional: Asegurar que el creado tenga member)
-- Esto solo muestra los últimos miembros creados para debug visual en la consola SQL
SELECT * FROM public.tenant_members ORDER BY created_at DESC LIMIT 5;
