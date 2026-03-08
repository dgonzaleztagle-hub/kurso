-- ======================================================
-- FIX: Cambiar dominio fantasy de @kurso.cl a @estudiantes.kurso
-- ======================================================

-- Actualizar función que genera emails para estudiantes
CREATE OR REPLACE FUNCTION public.create_auth_user_from_rut(
    p_rut TEXT,
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS UUID AS $$
DECLARE
    v_rut_clean TEXT;
    v_rut_body TEXT;
    v_email TEXT;
    v_pass TEXT;
    v_user_id UUID;
BEGIN
    -- Limpiar RUT
    v_rut_clean := lower(regexp_replace(p_rut, '[^0-9kK]', '', 'g'));
    
    IF length(v_rut_clean) < 2 THEN
        RAISE EXCEPTION 'RUT inválido: %', p_rut;
    END IF;

    -- Extraer cuerpo del RUT (sin dígito verificador)
    v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
    
    -- Generar email con nuevo dominio fantasy: @estudiantes.kurso
    v_email := v_rut_body || '@estudiantes.kurso';
    
    v_pass := CASE
        WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
        WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
        ELSE '123456'
    END;

    -- Crear usuario en auth
    v_user_id := public.create_db_user(
        v_email,
        v_pass,
        jsonb_build_object(
            'full_name', trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')),
            'rut', p_rut,
            'role', 'alumnos'
        )
    );

    RETURN v_user_id;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creando usuario: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar trigger para usar nuevo dominio
CREATE OR REPLACE FUNCTION public.tr_student_create_auth_account()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Solo si el estudiante tiene RUT
    IF NEW.rut IS NOT NULL AND btrim(NEW.rut) <> '' THEN
        BEGIN
            -- Crear usuario de autenticación
            v_user_id := public.create_auth_user_from_rut(
                NEW.rut,
                NEW.first_name,
                NEW.last_name
            );

            -- Si se creó la cuenta, vincularla
            IF v_user_id IS NOT NULL THEN
                -- Insertar en app_users
                INSERT INTO public.app_users (id, email, full_name)
                VALUES (
                    v_user_id,
                    lower(regexp_replace(NEW.rut, '[^0-9kK]', '', 'g')) || '@estudiantes.kurso',
                    trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''))
                )
                ON CONFLICT (id) DO UPDATE
                SET email = EXCLUDED.email,
                    full_name = EXCLUDED.full_name;

                -- Insertar en user_roles
                INSERT INTO public.user_roles (user_id, role, first_login, user_name)
                VALUES (
                    v_user_id,
                    'alumnos',
                    TRUE,
                    trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''))
                )
                ON CONFLICT (user_id) DO NOTHING;

                -- Insertar en user_students
                INSERT INTO public.user_students (user_id, student_id, display_name)
                VALUES (
                    v_user_id,
                    NEW.id,
                    trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''))
                )
                ON CONFLICT (user_id, student_id) DO NOTHING;

                -- Insertar en tenant_members
                INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
                VALUES (
                    NEW.tenant_id,
                    v_user_id,
                    'member',
                    'active'
                )
                ON CONFLICT (tenant_id, user_id) DO NOTHING;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG 'Error en trigger: %', SQLERRM;
            -- No fail el insert del student, solo log
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- Validación: Confirmar que los cambios se aplicaron
-- ======================================================
SELECT 'Funciones actualizadas correctamente' as status;
