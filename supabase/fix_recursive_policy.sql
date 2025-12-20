-- Fix Recursive RLS Policy on user_roles

-- The policy "Masters can read all roles" causes infinite recursion because it queries user_roles to check permission.
-- We drop it. For admin access, we should rely on RPCs (like get_users_managed_by_me) or a non-recursive check.

DROP POLICY IF EXISTS "Masters can read all roles" ON public.user_roles;

-- Ensure "Users can read own role" is present and correct
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());
