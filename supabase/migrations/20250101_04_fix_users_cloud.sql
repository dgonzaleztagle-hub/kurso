-- 1. Create or ensure demo@demo.cl exists in auth.users
-- This block uses a DO statement to perform checks and inserts
DO $$
DECLARE
    demo_email TEXT := 'demo@demo.cl';
    demo_uid UUID := '00000000-0000-0000-0000-000000000001'; -- Fixed ID for demo
BEGIN
    -- Check if auth user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = demo_email) THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_user_meta_data, created_at, updated_at, 
            confirmation_token, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            demo_uid,
            'authenticated',
            'authenticated',
            demo_email,
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"full_name": "Usuario Demo", "whatsapp": "+56900000000"}'::jsonb,
            NOW(),
            NOW(),
            '', ''
        );
    ELSE
         SELECT id INTO demo_uid FROM auth.users WHERE email = demo_email;
    END IF;

    -- Upsert app_users for Demo
    INSERT INTO public.app_users (id, email, full_name, whatsapp_number, is_superadmin)
    VALUES (demo_uid, demo_email, 'Usuario Demo', '+56900000000', false)
    ON CONFLICT (id) DO UPDATE
    SET full_name = 'Usuario Demo', 
        whatsapp_number = '+56900000000';
END $$;

-- 2. Force Update Daniel's Profile (SuperAdmin)
UPDATE public.app_users
SET 
    full_name = 'Daniel Gonzalez',
    whatsapp_number = '+56972739105',
    is_superadmin = true
WHERE email = 'dgonzalez.tagle@gmail.com';

-- 3. Fix RLS Recursion on Cloud DB (Apply Security Definer)
CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_users 
    WHERE id = auth.uid() 
    AND is_superadmin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.app_users;

CREATE POLICY "SuperAdmins can view all profiles"
ON public.app_users
FOR SELECT
USING (
  public.check_is_superadmin() = true
);
