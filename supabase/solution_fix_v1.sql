-- ==============================================================================
-- SOLUCIÓN INTEGRAL V1
-- ==============================================================================
-- Instrucciones: Copie todo este contenido y ejecútelo en el SQL Editor de Supabase.
-- Resuelve: Error 500 (Recursividad) y Generación de Cuentas (Sin Terminal).

-- 1. CORREGIR ERROR 500 (RECURSIVIDAD)
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Masters can read all roles" ON public.user_roles;

-- Asegurar política base correcta
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());


-- 2. HABILITAR CREACIÓN DE USUARIOS DESDE BASE DE DATOS (SIN TERMINAL)
--------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función de ayuda para crear un usuario individual
CREATE OR REPLACE FUNCTION public.create_db_user(
    p_email TEXT,
    p_password TEXT,
    p_metadata JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_enc_pass TEXT;
BEGIN
    -- Check if exists
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
    IF v_user_id IS NOT NULL THEN
        RETURN v_user_id;
    END IF;

    -- Generate ID and Hash
    v_user_id := gen_random_uuid();
    v_enc_pass := crypt(p_password, gen_salt('bf'));

    -- Insert into auth.users (Standard Supabase Schema)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        p_email,
        v_enc_pass,
        NOW(), -- Auto confirm
        '{"provider": "email", "providers": ["email"]}',
        p_metadata,
        NOW(),
        NOW(),
        '',
        ''
    );

    -- Insert identity (Required for login sometimes)
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id, 'email', p_email),
        'email',
        NOW(),
        NOW(),
        NOW()
    );

    RETURN v_user_id;
END;
$$;


-- Función Principal para Generación Masiva (Llamable desde el Botón Web)
CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r_student RECORD;
    v_rut_clean TEXT;
    v_email TEXT;
    v_pass TEXT;
    v_user_id UUID;
    v_count INT := 0;
BEGIN
    -- Loop through students in tenant who DON'T have a user_students link
    FOR r_student IN 
        SELECT s.* 
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id
        AND s.rut IS NOT NULL
        AND s.rut != ''
        AND NOT EXISTS (
            SELECT 1 FROM public.user_students us 
            WHERE us.student_id = s.id
        )
    LOOP
        -- Logic: 
        -- RUT: 19.788.597-1 -> Clean: 197885971 -> Email: 197885971@kurso.cl
        -- Pass: 197885 (First 6)
        
        v_rut_clean := lower(regexp_replace(r_student.rut, '[^0-9kK]', '', 'g'));
        IF length(v_rut_clean) < 2 THEN CONTINUE; END IF;
        
        v_email := v_rut_clean || '@kurso.cl';
        v_pass := substring(v_rut_clean from 1 for 6);
        
        -- 1. Create Auth User
        v_user_id := public.create_db_user(
            v_email, 
            v_pass, 
            jsonb_build_object(
                'full_name', r_student.first_name || ' ' || r_student.last_name,
                'rut', r_student.rut,
                'role', 'alumnos'
            )
        );

        -- 2. Create App User (Trigger might do this, but ensure)
        INSERT INTO public.app_users (id, email, full_name)
        VALUES (v_user_id, v_email, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (id) DO NOTHING;

        -- 3. Link Roles
        INSERT INTO public.user_roles (user_id, role, first_login, user_name)
        VALUES (v_user_id, 'alumnos', TRUE, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (user_id) DO NOTHING;

        -- 4. Link Student (Crucial)
        INSERT INTO public.user_students (user_id, student_id, display_name)
        VALUES (v_user_id, r_student.id, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (user_id, student_id) DO NOTHING;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'created', v_count);
END;
$$;
