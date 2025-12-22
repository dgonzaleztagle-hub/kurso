-- ==============================================================================
-- UNIFY OWNERS MIGRATION: ONE ROLE TO RULE THEM ALL
-- ==============================================================================

-- 1. DATA MIGRATION: Convert Admins and Masters to Owners
-- ------------------------------------------------------------------------------
UPDATE public.tenant_members
SET role = 'owner'
WHERE role IN ('admin', 'master');

UPDATE public.user_roles -- Legacy table if still used
SET role = 'owner'
WHERE role IN ('admin', 'master');

-- 2. SECURITY UPGRADE: Allow Owners to see and manage everything in their Tenant
-- (Using SECURITY DEFINER to avoid recursion loops)
-- ------------------------------------------------------------------------------

-- A. Helper Function: Am I an Owner of this tenant? (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_is_owner(target_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = target_tenant_id
        AND user_id = auth.uid()
        AND role = 'owner'
    );
END;
$$;

-- B. Helper Function: Can I view this user profile?
-- I can view if: It's me OR We share a tenant where I am an Owner.
CREATE OR REPLACE FUNCTION public.check_can_view_user_as_owner(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Self
    IF target_user_id = auth.uid() THEN RETURN TRUE; END IF;
    
    -- 2. I am an Owner of a tenant where target_user is a member
    RETURN EXISTS (
        SELECT 1 
        FROM public.tenant_members as my_tm
        JOIN public.tenant_members as their_tm ON my_tm.tenant_id = their_tm.tenant_id
        WHERE my_tm.user_id = auth.uid()
        AND my_tm.role = 'owner' -- Only Owners get to peek
        AND their_tm.user_id = target_user_id
    );
END;
$$;

-- 3. APPLY RLS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;

-- --- TENANTS ---
-- Owners can edit their tenants
DROP POLICY IF EXISTS "Restore: Owner Updates Tenant" ON public.tenants; 
DROP POLICY IF EXISTS "Admins and Owners can update tenant" ON public.tenants;

CREATE POLICY "Owners can update tenant" ON public.tenants
FOR UPDATE TO authenticated
USING ( public.check_is_owner(id) )
WITH CHECK ( public.check_is_owner(id) );

-- Users see tenants they belong to
DROP POLICY IF EXISTS "Restore: View My Tenants" ON public.tenants;
CREATE POLICY "Users view own tenants" ON public.tenants
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
    )
);

-- --- TENANT MEMBERS ---
-- Owners see ALL members. Regular users (Students/Members) see ONLY THEMSELVES (Privacy).
-- Or maybe regular users see minimal info? Let's stick to Owner Power.

DROP POLICY IF EXISTS "Restore: View Own Memberships" ON public.tenant_members;
DROP POLICY IF EXISTS "Users can view relevant memberships" ON public.tenant_members;

CREATE POLICY "Owners view all, Users view self" ON public.tenant_members
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() -- I see myself
    OR
    public.check_is_owner(tenant_id) -- I see everyone if I'm owner
);

-- Owners manage members
DROP POLICY IF EXISTS "Admins and Owners can manage members" ON public.tenant_members;
CREATE POLICY "Owners manage members" ON public.tenant_members
FOR ALL TO authenticated
USING ( public.check_is_owner(tenant_id) )
WITH CHECK ( public.check_is_owner(tenant_id) );

-- --- APP USERS ---
-- Owners see profiles of their members.
DROP POLICY IF EXISTS "Restore: View Own Profile" ON public.app_users;
DROP POLICY IF EXISTS "Safe View Profiles" ON public.app_users;

CREATE POLICY "Owners view members, Users view self" ON public.app_users
FOR SELECT TO authenticated
USING ( public.check_can_view_user_as_owner(id) );

-- Update Self remains
-- (Assuming "Restore: Update Own Profile" is present, if not create it)
DROP POLICY IF EXISTS "Restore: Update Own Profile" ON public.app_users;
CREATE POLICY "Users update own profile" ON public.app_users
FOR UPDATE TO authenticated
USING ( id = auth.uid() )
WITH CHECK ( id = auth.uid() );


-- 4. RE-ENABLE RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
