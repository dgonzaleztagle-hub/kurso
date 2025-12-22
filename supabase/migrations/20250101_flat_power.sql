-- ==============================================================================
-- FLAT POWER MIGRATION: Equalize Owner and Admin Privileges
-- ==============================================================================

-- 1. TENANTS TABLE (Allow Admins to edit tenant details)
-- Current policy usually restricts to Owner. We expand it.
DROP POLICY IF EXISTS "Admins and Owners can update tenant" ON public.tenants;
CREATE POLICY "Admins and Owners can update tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role IN ('owner', 'admin', 'master')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role IN ('owner', 'admin', 'master')
    )
);

-- 2. TENANT_MEMBERS TABLE (Allow Admins to manage members)
-- Crucial for inviting other users or removing them.
DROP POLICY IF EXISTS "Admins and Owners can manage members" ON public.tenant_members;
CREATE POLICY "Admins and Owners can manage members"
ON public.tenant_members
FOR ALL -- INSERT, UPDATE, DELETE, SELECT
TO authenticated
USING (
    -- Allow if I am an Admin/Owner of the target tenant (found via the row being accessed or subquery)
    -- CASE: Operations on existing rows (UPDATE/DELETE/SELECT)
    EXISTS (
        SELECT 1 FROM public.tenant_members as my_membership
        WHERE my_membership.tenant_id = tenant_members.tenant_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.role IN ('owner', 'admin', 'master')
    )
    OR
    -- CASE: INSERT (No existing row to check tenant_id against easily, but we can check the NEW row in WITH CHECK)
    -- For SELECT/USING part of INSERT, we can rely on RLS generally allowing access if you have permissions.
    -- But strict RLS for INSERT usually uses WITH CHECK.
    (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
)
WITH CHECK (
    -- Ensure I am an Admin/Owner of the tenant I'm adding members to
    EXISTS (
        SELECT 1 FROM public.tenant_members as my_membership
        WHERE my_membership.tenant_id = tenant_members.tenant_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.role IN ('owner', 'admin', 'master')
    )
    OR
    (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
);

-- 3. VERIFY APP_USERS ACCESS (Admins often need to read profiles of members)
-- Usually covered by "Authenticated users can view profiles" but ensuring here.
DROP POLICY IF EXISTS "Tenant members can view profiles of other members" ON public.app_users;
CREATE POLICY "Tenant members can view profiles of other members"
ON public.app_users
FOR SELECT
TO authenticated
USING (
    -- I can see a user if we share a tenant
    EXISTS (
        SELECT 1 
        FROM public.tenant_members as my_tm
        JOIN public.tenant_members as their_tm ON my_tm.tenant_id = their_tm.tenant_id
        WHERE my_tm.user_id = auth.uid()
        AND their_tm.user_id = app_users.id
    )
);
