CREATE OR REPLACE FUNCTION public.get_platform_clients()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    email TEXT,
    whatsapp_number TEXT,
    tenant_name TEXT,
    created_at TIMESTAMPTZ,
    tenant_id UUID,
    subscription_status TEXT,
    trial_ends_at TIMESTAMPTZ,
    valid_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar si el usuario actual es SuperAdmin
    IF NOT check_is_superadmin() THEN
        RAISE EXCEPTION 'Acceso denegado. Solo SuperAdmins.';
    END IF;

    RETURN QUERY
    SELECT 
        au.id,
        au.full_name,
        au.email,
        au.whatsapp_number,
        t.name as tenant_name,
        au.created_at,
        t.id as tenant_id,
        t.subscription_status::TEXT,
        t.trial_ends_at,
        t.valid_until
    FROM 
        public.app_users au
    JOIN 
        public.tenants t ON au.id = t.owner_id
    WHERE 
        t.organization_id IS NULL -- Excluir Instituciones
    ORDER BY 
        au.created_at DESC;
END;
$$;
