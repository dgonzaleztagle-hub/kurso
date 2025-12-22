-- 1. Ensure function exists (Anti-Recursion / Security Definer)
CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_users 
        WHERE id = auth.uid() 
        AND is_superadmin = true
    );
END;
$$;

-- 2. Apply Policy
-- Use DROP IF EXISTS to avoid errors on re-run
DROP POLICY IF EXISTS "SuperAdmins view all profiles" ON public.app_users;

CREATE POLICY "SuperAdmins view all profiles"
ON public.app_users
FOR SELECT
USING (
  check_is_superadmin()
);

-- 3. Ensure Security
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_users TO authenticated;
