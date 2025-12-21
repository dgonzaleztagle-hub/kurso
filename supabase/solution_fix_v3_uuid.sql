-- ==============================================================================
-- SOLUCIÓN V3: CORRECCIÓN DE TIPO UUID
-- ==============================================================================
-- Instrucciones: Ejecuta esto en SQL Editor para corregir el tipo de dato del tenant_id.
-- El error anterior ocurría porque definimos tenant_id como INT pero tu base de datos usa UUID.

-- Borramos la función incorrecta (la de INT)
DROP FUNCTION IF EXISTS public.generate_missing_accounts(INT);

-- Creamos la función correcta (con UUID)
CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r_student RECORD;
    v_rut_clean TEXT;
    v_email TEXT;
    v_pass TEXT;
    v_user_id UUID;
    v_count INT := 0;
    v_linked INT := 0;
BEGIN
    -- Recorremos TODOS los alumnos del tenant
    FOR r_student IN 
        SELECT s.* 
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id -- Aquí postgres hace match automático si ambos son UUID
        AND s.rut IS NOT NULL
        AND s.rut != ''
    LOOP
        -- Limpieza RUT
        v_rut_clean := lower(regexp_replace(r_student.rut, '[^0-9kK]', '', 'g'));
        IF length(v_rut_clean) < 2 THEN CONTINUE; END IF;
        
        v_email := v_rut_clean || '@kurso.cl';
        v_pass := substring(v_rut_clean from 1 for 6);
        
        -- 1. Obtener o Crear Usuario Auth
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
        
        IF v_user_id IS NULL THEN
            -- LLamamos a create_db_user (Si no existe, la definimos abajo por seguridad)
            v_user_id := public.create_db_user(
                v_email, 
                v_pass, 
                jsonb_build_object(
                    'full_name', r_student.first_name || ' ' || r_student.last_name,
                    'rut', r_student.rut,
                    'role', 'alumnos'
                )
            );
            v_count := v_count + 1;
        END IF;

        -- 2. Asegurar link en user_students
        IF NOT EXISTS (SELECT 1 FROM public.user_students WHERE user_id = v_user_id AND student_id = r_student.id) THEN
             INSERT INTO public.user_students (user_id, student_id, display_name)
             VALUES (v_user_id, r_student.id, r_student.first_name || ' ' || r_student.last_name)
             ON CONFLICT (user_id, student_id) DO NOTHING;
             v_linked := v_linked + 1;
        END IF;

        -- 3. Asegurar Rol y App User (Idempotente)
        INSERT INTO public.user_roles (user_id, role, first_login, user_name)
        VALUES (v_user_id, 'alumnos', TRUE, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.app_users (id, email, full_name)
        VALUES (v_user_id, v_email, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (id) DO NOTHING;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'created', v_count, 'linked', v_linked);
END;
$$;

-- Aseguramos que create_db_user exista (por si acaso no corrió la V1 completa)
CREATE OR REPLACE FUNCTION public.create_db_user(
    p_email TEXT,
    p_password TEXT,
    p_metadata JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_enc_pass TEXT;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
    IF v_user_id IS NOT NULL THEN RETURN v_user_id; END IF;

    v_user_id := gen_random_uuid();
    v_enc_pass := crypt(p_password, gen_salt('bf'));

    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_email, v_enc_pass, NOW(), '{"provider": "email", "providers": ["email"]}', p_metadata, NOW(), NOW());

    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id, 'email', p_email), 'email', NOW(), NOW(), NOW());

    RETURN v_user_id;
END;
$$;
