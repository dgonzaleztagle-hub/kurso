CREATE OR REPLACE FUNCTION public.create_db_user(
    p_email TEXT,
    p_password TEXT,
    p_metadata JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_enc_pass TEXT;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    IF v_user_id IS NULL THEN
        v_user_id := extensions.gen_random_uuid();
        v_enc_pass := extensions.crypt(p_password, extensions.gen_salt('bf'));

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
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            p_email,
            v_enc_pass,
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            p_metadata,
            NOW(),
            NOW()
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM auth.identities
        WHERE user_id = v_user_id
          AND provider = 'email'
    ) THEN
        INSERT INTO auth.identities (
            id,
            provider_id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            extensions.gen_random_uuid(),
            v_user_id::text,
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', p_email),
            'email',
            NOW(),
            NOW(),
            NOW()
        );
    END IF;

    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_student RECORD;
    v_rut_clean TEXT;
    v_rut_body TEXT;
    v_email TEXT;
    v_pass TEXT;
    v_user_id UUID;
    v_created INT := 0;
    v_linked INT := 0;
BEGIN
    FOR r_student IN
        SELECT s.*
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id
          AND s.rut IS NOT NULL
          AND btrim(s.rut) <> ''
    LOOP
        v_rut_clean := lower(regexp_replace(r_student.rut, '[^0-9kK]', '', 'g'));
        IF length(v_rut_clean) < 2 THEN
            CONTINUE;
        END IF;

        v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
        v_email := v_rut_body || '@kurso.cl';
        v_pass := CASE
            WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
            WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
            ELSE '123456'
        END;

        SELECT id INTO v_user_id
        FROM auth.users
        WHERE email = v_email;

        IF v_user_id IS NULL THEN
            v_user_id := public.create_db_user(
                v_email,
                v_pass,
                jsonb_build_object(
                    'full_name', trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, '')),
                    'rut', r_student.rut,
                    'role', 'alumnos'
                )
            );
            v_created := v_created + 1;
        END IF;

        INSERT INTO public.app_users (id, email, full_name)
        VALUES (
            v_user_id,
            v_email,
            trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = EXCLUDED.full_name;

        INSERT INTO public.user_roles (user_id, role, first_login, user_name)
        VALUES (
            v_user_id,
            'alumnos',
            TRUE,
            trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
        )
        ON CONFLICT (user_id) DO UPDATE
        SET role = 'alumnos',
            user_name = EXCLUDED.user_name;

        INSERT INTO public.user_students (user_id, student_id, display_name)
        VALUES (
            v_user_id,
            r_student.id,
            trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
        )
        ON CONFLICT (user_id, student_id) DO UPDATE
        SET display_name = EXCLUDED.display_name;

        IF FOUND THEN
            v_linked := v_linked + 1;
        END IF;

        INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
        VALUES (p_tenant_id, v_user_id, 'alumnos', 'active')
        ON CONFLICT (tenant_id, user_id) DO UPDATE
        SET role = 'alumnos',
            status = 'active';
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'created', v_created,
        'linked', v_linked
    );
END;
$$;
