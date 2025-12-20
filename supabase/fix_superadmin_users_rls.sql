-- FIX: Allow SuperAdmins to view ALL users in app_users table
-- Currently only "Users can view own profile" exists.

CREATE POLICY "SuperAdmins can view all profiles"
ON public.app_users
FOR SELECT
USING (
    (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
);

-- Optional: Allow SuperAdmins to update users (e.g. promoting them)
CREATE POLICY "SuperAdmins can update all profiles"
ON public.app_users
FOR UPDATE
USING (
    (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
);
