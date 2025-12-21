-- ==============================================================================
-- SOLUCIÓN V4: FIX IDENTITY PROVIDER
-- ==============================================================================
-- Instrucciones: Ejecuta esto en SQL Editor.
-- Resuelve el error "null value in column provider_id".

CREATE OR REPLACE FUNCTION public.create_db_user(
    p_email TEXT,
    p_password TEXT,
    p_metadata JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_enc_pass TEXT;
BEGIN
    -- 1. Verificar si existe
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
    IF v_user_id IS NOT NULL THEN RETURN v_user_id; END IF;

    -- 2. Generar ID y Hash
    v_user_id := gen_random_uuid();
    v_enc_pass := crypt(p_password, gen_salt('bf'));

    -- 3. Insertar en AUTH.USERS
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
        confirmation_token, recovery_token, is_super_admin
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', 
        p_email, v_enc_pass, NOW(), 
        '{"provider": "email", "providers": ["email"]}', p_metadata, NOW(), NOW(), 
        '', '', FALSE
    );

    -- 4. Insertar en AUTH.IDENTITIES (Corregido: provider_id = email)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id, 
        jsonb_build_object('sub', v_user_id, 'email', p_email), 
        'email', p_email, -- <--- Aquí estaba el error, faltaba este campo
        NOW(), NOW(), NOW()
    );

    RETURN v_user_id;
END;
$$;
