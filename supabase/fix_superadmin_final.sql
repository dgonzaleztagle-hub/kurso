-- 1. Fix Recursion: Create a secure function to check superadmin status
CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_users 
    WHERE id = auth.uid() 
    AND is_superadmin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER bypasses RLS

-- 2. Drop the recursive policy if it exists and recreate it using the function
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.app_users;

CREATE POLICY "SuperAdmins can view all profiles"
ON public.app_users
FOR SELECT
USING (
  public.check_is_superadmin() = true
);

-- 3. Update User Data (Daniel Gonzalez)
UPDATE public.app_users
SET 
    full_name = 'Daniel Gonzalez',
    whatsapp_number = '+56972739105'
WHERE email = 'dgonzalez.tagle@gmail.com';
