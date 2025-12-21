-- ==============================================================================
-- SOLUCIÓN V2: FUERZA BRUTA (FIX ZOMBIES)
-- ==============================================================================
-- Instrucciones: Ejecuta esto en SQL Editor para actualizar la lógica de generación.
-- Cambios: Ahora verifica TODOS los alumnos y crea sus cuentas si faltan, incluso si el sistema creía que ya existían.

CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id INT)
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
    -- Recorremos TODOS los alumnos del tenant (sin filtrar si ya tienen link)
    FOR r_student IN 
        SELECT s.* 
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id
        AND s.rut IS NOT NULL
        AND s.rut != ''
    LOOP
        -- Limpieza RUT
        v_rut_clean := lower(regexp_replace(r_student.rut, '[^0-9kK]', '', 'g'));
        IF length(v_rut_clean) < 2 THEN CONTINUE; END IF;
        
        v_email := v_rut_clean || '@kurso.cl';
        v_pass := substring(v_rut_clean from 1 for 6);
        
        -- 1. Obtener o Crear Usuario Auth
        -- Check if user exists explicitly
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
        
        IF v_user_id IS NULL THEN
            -- create_db_user debe estar definida (del script V1)
            -- Si no, la re-definimos aqui corto para asegurar
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

        -- 3. Asegurar Rol
        INSERT INTO public.user_roles (user_id, role, first_login, user_name)
        VALUES (v_user_id, 'alumnos', TRUE, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (user_id) DO NOTHING;

         -- 4. Asegurar App User
        INSERT INTO public.app_users (id, email, full_name)
        VALUES (v_user_id, v_email, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (id) DO NOTHING;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'created', v_count, 'linked', v_linked);
END;
$$;
