-- ============================================================
-- Student auth hardening (domain + tenant role alignment)
-- Date: 2026-03-08
-- ============================================================

-- 1) Keep existing student users reachable after domain transition
UPDATE auth.users au
SET email = regexp_replace(au.email, '@kurso\.cl$', '@estudiantes.kurso')
FROM public.user_roles ur
WHERE ur.user_id = au.id
  AND ur.role = 'alumnos'
  AND au.email ~ '@kurso\.cl$';

UPDATE public.app_users ap
SET email = regexp_replace(ap.email, '@kurso\.cl$', '@estudiantes.kurso')
FROM public.user_roles ur
WHERE ur.user_id = ap.id
  AND ur.role = 'alumnos'
  AND ap.email ~ '@kurso\.cl$';

-- 2) Ensure tenant role for students is compatible with route guards
UPDATE public.tenant_members tm
SET role = 'alumnos'
FROM public.user_roles ur
WHERE ur.user_id = tm.user_id
  AND ur.role = 'alumnos'
  AND tm.role IN ('member', 'student');

-- 3) New student creation should use @estudiantes.kurso + alumnos role
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
    v_rut_clean := lower(regexp_replace(p_rut, '[^0-9kK]', '', 'g'));

    IF length(v_rut_clean) < 2 THEN
        RAISE EXCEPTION 'RUT inválido: %', p_rut;
    END IF;

    v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
    v_email := v_rut_body || '@estudiantes.kurso';

    v_pass := CASE
        WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
        WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
        ELSE '123456'
    END;

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

CREATE OR REPLACE FUNCTION public.tr_student_create_auth_account()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_full_name TEXT;
    v_email TEXT;
BEGIN
    IF NEW.rut IS NOT NULL AND btrim(NEW.rut) <> '' THEN
        BEGIN
            v_user_id := public.create_auth_user_from_rut(
                NEW.rut,
                NEW.first_name,
                NEW.last_name
            );

            IF v_user_id IS NOT NULL THEN
                v_full_name := trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
                v_email := lower(regexp_replace(NEW.rut, '[^0-9kK]', '', 'g'));
                v_email := substring(v_email from 1 for length(v_email) - 1) || '@estudiantes.kurso';

                INSERT INTO public.app_users (id, email, full_name)
                VALUES (v_user_id, v_email, v_full_name)
                ON CONFLICT (id) DO UPDATE
                SET email = EXCLUDED.email,
                    full_name = EXCLUDED.full_name;

                INSERT INTO public.user_roles (user_id, role, first_login, user_name)
                VALUES (v_user_id, 'alumnos', TRUE, v_full_name)
                ON CONFLICT (user_id) DO UPDATE
                SET role = 'alumnos',
                    user_name = EXCLUDED.user_name;

                INSERT INTO public.user_students (user_id, student_id, display_name)
                VALUES (v_user_id, NEW.id, v_full_name)
                ON CONFLICT (user_id, student_id) DO UPDATE
                SET display_name = EXCLUDED.display_name;

                IF NEW.tenant_id IS NOT NULL THEN
                    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
                    VALUES (NEW.tenant_id, v_user_id, 'alumnos', 'active')
                    ON CONFLICT (tenant_id, user_id) DO UPDATE
                    SET role = 'alumnos',
                        status = 'active';
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG 'Error vinculando usuario para estudiante %: %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Backfill RPC aligned to new domain
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
    v_errors INT := 0;
BEGIN
    FOR r_student IN
        SELECT s.*
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id
          AND s.rut IS NOT NULL
          AND btrim(s.rut) <> ''
    LOOP
        BEGIN
            v_rut_clean := lower(regexp_replace(r_student.rut, '[^0-9kK]', '', 'g'));
            IF length(v_rut_clean) < 2 THEN
                CONTINUE;
            END IF;

            v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
            v_email := v_rut_body || '@estudiantes.kurso';
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
            VALUES (v_user_id, v_email, trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, '')))
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
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            RAISE LOG 'Error procesando estudiante %: %', r_student.id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'created', v_created,
        'linked', v_linked,
        'errors', v_errors
    );
END;
$$;
