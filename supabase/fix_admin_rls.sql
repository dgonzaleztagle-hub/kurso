-- Enable RLS (idempotent)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 1. Policies for ORGANIZATIONS
DROP POLICY IF EXISTS "SuperAdmin view all orgs" ON public.organizations;
CREATE POLICY "SuperAdmin view all orgs" ON public.organizations
    FOR SELECT
    USING (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    );

DROP POLICY IF EXISTS "SuperAdmin manage all orgs" ON public.organizations;
CREATE POLICY "SuperAdmin manage all orgs" ON public.organizations
    FOR ALL
    USING (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    )
    WITH CHECK (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    );


-- 2. Policies for TENANTS
DROP POLICY IF EXISTS "SuperAdmin view all tenants" ON public.tenants;
CREATE POLICY "SuperAdmin view all tenants" ON public.tenants
    FOR SELECT
    USING (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    );

DROP POLICY IF EXISTS "SuperAdmin manage all tenants" ON public.tenants;
CREATE POLICY "SuperAdmin manage all tenants" ON public.tenants
    FOR ALL
    USING (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    )
    WITH CHECK (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    );
