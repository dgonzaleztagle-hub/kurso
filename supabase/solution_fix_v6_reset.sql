-- ==============================================================================
-- SOLUCIÓN V6: RESET TOTAL Y CAMBIO DE FORMATO (RUT-DV)
-- ==============================================================================
-- Instrucciones: 
-- 1. Ejecutar esto para LIMPIAR las cuentas mal generadas (sin guión) y actualizar la lógica.
-- 2. Ejecutar luego el comando de generación nuevamente.

-- A. LIMPIEZA DE CUENTAS MAL FORMATEADAS (SIN GUIÓN)
--------------------------------------------------------------------------------
-- Borramos usuarios auth que tengan email tipo '123456789@kurso.cl' (SOLO números antes del @)
-- Esto NO borra usuarios reales normales ni admins (que tienen letras en el email usualmente)
-- Y NO borra los que tengan guión (formato correcto).
DELETE FROM auth.users 
WHERE email ~ '^[0-9]+@kurso.cl';

-- B. ACTUALIZAR FUNCIÓN GENERADORA (FORMATO CON GUIÓN)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r_student RECORD;
    v_rut_clean TEXT; -- 123456789
    v_rut_format TEXT; -- 12345678-9
    v_email TEXT;
    v_pass TEXT;
    v_user_id UUID;
    v_count INT := 0;
    v_linked INT := 0;
BEGIN
    FOR r_student IN 
        SELECT s.* 
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id
        AND s.rut IS NOT NULL
        AND s.rut != ''
    LOOP
        -- 1. Limpieza base (solo números y K)
        v_rut_clean := lower(regexp_replace(r_student.rut, '[^0-9kK]', '', 'g'));
        IF length(v_rut_clean) < 2 THEN CONTINUE; END IF;
        
        -- 2. Formato CON GUIÓN (Cuerpo + DV)
        -- Si termina en K o numero, separamos último caracter
        v_rut_format := substring(v_rut_clean from 1 for length(v_rut_clean)-1) || '-' || substring(v_rut_clean from length(v_rut_clean) for 1);
        
        v_email := v_rut_format || '@kurso.cl'; -- Ej: 12345678-9@kurso.cl
        v_pass := substring(v_rut_clean from 1 for 6); -- Pass sigue siendo primeros 6 digitos limpios
        
        -- 3. Obtener o Crear Usuario Auth
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
        
        IF v_user_id IS NULL THEN
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

        -- 4. Links
        IF NOT EXISTS (SELECT 1 FROM public.user_students WHERE user_id = v_user_id AND student_id = r_student.id) THEN
             INSERT INTO public.user_students (user_id, student_id, display_name)
             VALUES (v_user_id, r_student.id, r_student.first_name || ' ' || r_student.last_name)
             ON CONFLICT (user_id, student_id) DO NOTHING;
             v_linked := v_linked + 1;
        END IF;

        INSERT INTO public.user_roles (user_id, role, first_login, user_name)
        VALUES (v_user_id, 'alumnos', TRUE, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.app_users (id, email, full_name)
        VALUES (v_user_id, v_email, r_student.first_name || ' ' || r_student.last_name)
        ON CONFLICT (id) DO NOTHING;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'created', v_count, 'format', 'RUT-DV');
END;
$$;

-- C. ASEGURAR DROP DE POLITICA RECURSIVA (POR SI ACASO)
-- D. CORRECCIÓN USUARIO ADMIN (ERROR 406)
DO $$
DECLARE
    v_my_id UUID;
    v_email TEXT;
BEGIN
    v_my_id := auth.uid();
    IF v_my_id IS NULL THEN
        SELECT id, email INTO v_my_id, v_email FROM auth.users ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_my_id IS NOT NULL THEN
        INSERT INTO public.app_users (id, email) VALUES (v_my_id, 'admin@kurso.cl') ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.user_roles (user_id, role, first_login, user_name)
        VALUES (v_my_id, 'master', FALSE, 'Admin')
        ON CONFLICT (user_id) DO UPDATE SET role = 'master';
    END IF;
END $$;
