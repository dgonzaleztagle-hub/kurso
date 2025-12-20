-- FIX RLS TENANT_MEMBERS
-- Permite al SuperAdmin ver y gestionar miembros de tenants

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- 1. Política de Lectura (SELECT)
DROP POLICY IF EXISTS "SuperAdmin view all members" ON public.tenant_members;
CREATE POLICY "SuperAdmin view all members" ON public.tenant_members
    FOR SELECT
    USING (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    );

-- 2. Política de Gestión Total (ALL)
DROP POLICY IF EXISTS "SuperAdmin manage all members" ON public.tenant_members;
CREATE POLICY "SuperAdmin manage all members" ON public.tenant_members
    FOR ALL
    USING (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    )
    WITH CHECK (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    );
