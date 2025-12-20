-- 1. Ensure 'demo@demo.cl' exists in app_users (if auth user exists)
-- This tries to insert or update the demo user profile if the auth user exists
DO $$
DECLARE
    demo_uid UUID;
BEGIN
    SELECT id INTO demo_uid FROM auth.users WHERE email = 'demo@demo.cl';
    
    IF demo_uid IS NOT NULL THEN
        INSERT INTO public.app_users (id, email, full_name, whatsapp_number, is_superadmin)
        VALUES (demo_uid, 'demo@demo.cl', 'Usuario Demo', '+56900000000', false)
        ON CONFLICT (id) DO UPDATE
        SET full_name = 'Usuario Demo', 
            whatsapp_number = '+56900000000';
    END IF;
END $$;

-- 2. Force Update My Profile (Daniel)
UPDATE public.app_users
SET 
    full_name = 'Daniel Gonzalez',
    whatsapp_number = '+56972739105',
    is_superadmin = true
WHERE email = 'dgonzalez.tagle@gmail.com';

-- 3. Verify RLS (Again)
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.app_users;
CREATE POLICY "SuperAdmins can view all profiles"
ON public.app_users
FOR SELECT
USING (
  public.check_is_superadmin() = true
);
