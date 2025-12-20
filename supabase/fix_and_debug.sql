-- SHERLOCK FIX: 
-- 1. Create demo@demo.cl in auth.users if not exists
-- 2. Force update Daniel's profile with loose matching

DO $$
DECLARE
    demo_uid UUID := '00000000-0000-0000-0000-000000000001'; -- Hardcoded ID for reliability
    daniel_email TEXT := 'dgonzalez.tagle@gmail.com';
BEGIN
    ----------------------------------------------------------------
    -- 1. HANDLE DEMO USER
    ----------------------------------------------------------------
    -- Check if exists in auth (by email)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@demo.cl') THEN
        RAISE NOTICE 'Creating auth user for demo@demo.cl...';
        
        -- Insert into auth.users (Minimal fields required)
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            demo_uid,
            'authenticated',
            'authenticated',
            'demo@demo.cl',
            crypt('password123', gen_salt('bf')), -- Password: password123
            NOW(),
            '{"full_name": "Usuario Demo", "whatsapp": "+56900000000"}'::jsonb,
            NOW(),
            NOW()
        );
    ELSE
        RAISE NOTICE 'Auth user demo@demo.cl already exists.';
        SELECT id INTO demo_uid FROM auth.users WHERE email = 'demo@demo.cl';
    END IF;

    -- Upsert into app_users
    INSERT INTO public.app_users (id, email, full_name, whatsapp_number, is_superadmin)
    VALUES (demo_uid, 'demo@demo.cl', 'Usuario Demo', '+56900000000', false)
    ON CONFLICT (id) DO UPDATE
    SET full_name = 'Usuario Demo', 
        whatsapp_number = '+56900000000';

    ----------------------------------------------------------------
    -- 2. HANDLE DANIEL (SUPERADMIN)
    ----------------------------------------------------------------
    -- Update with loose matching (Trim + ILIKE)
    UPDATE public.app_users
    SET 
        full_name = 'Daniel Gonzalez',
        whatsapp_number = '+56972739105',
        is_superadmin = true
    WHERE TRIM(LOWER(email)) = TRIM(LOWER(daniel_email));
    
    IF FOUND THEN
        RAISE NOTICE 'Updated profile for %', daniel_email;
    ELSE
        RAISE WARNING 'Could not find profile for %', daniel_email;
    END IF;

END $$;
