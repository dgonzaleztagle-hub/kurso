-- ============================================================
-- Fix create_db_user: ensure auth.identities.provider_id is set
-- Date: 2026-03-08
-- Root cause: account creation fails with NOT NULL violation on provider_id
-- ============================================================

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
    v_email TEXT;
BEGIN
    v_email := lower(trim(p_email));

    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_email
    LIMIT 1;

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
            v_email,
            v_enc_pass,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            coalesce(p_metadata, '{}'::jsonb),
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
            v_email,
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_email),
            'email',
            NOW(),
            NOW(),
            NOW()
        );
    ELSE
        UPDATE auth.identities
        SET provider_id = v_email,
            identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('sub', v_user_id::text, 'email', v_email),
            updated_at = NOW()
        WHERE user_id = v_user_id
          AND provider = 'email'
          AND (provider_id IS NULL OR provider_id = '' OR identity_data IS NULL);
    END IF;

    RETURN v_user_id;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creando usuario de auth: %', SQLERRM;
END;
$$;
