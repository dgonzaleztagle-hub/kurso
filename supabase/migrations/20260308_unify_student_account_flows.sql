-- ============================================================
-- Unify student account flows (single student + batch)
-- Date: 2026-03-08
-- ============================================================

-- Canonical helpers: one email format + one initial password policy
CREATE OR REPLACE FUNCTION public.student_auth_email_from_rut(p_rut TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rut_clean TEXT;
  v_rut_body TEXT;
BEGIN
  v_rut_clean := lower(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));
  IF length(v_rut_clean) < 2 THEN
    RETURN NULL;
  END IF;

  v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
  RETURN v_rut_body || '@estudiantes.kurso';
END;
$$;

CREATE OR REPLACE FUNCTION public.student_auth_initial_password_from_rut(p_rut TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rut_clean TEXT;
  v_rut_body TEXT;
BEGIN
  v_rut_clean := lower(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));
  IF length(v_rut_clean) < 2 THEN
    RETURN NULL;
  END IF;

  v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
  RETURN CASE
    WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
    WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
    ELSE '123456'
  END;
END;
$$;

-- Canonical flow for one student
CREATE OR REPLACE FUNCTION public.ensure_student_account(p_student_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_email TEXT;
  v_pass TEXT;
  v_user_id UUID;
  v_created BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_student
  FROM public.students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'student_not_found',
      'student_id', p_student_id
    );
  END IF;

  IF v_student.rut IS NULL OR btrim(v_student.rut) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'student_without_rut',
      'student_id', p_student_id
    );
  END IF;

  v_email := public.student_auth_email_from_rut(v_student.rut);
  v_pass := public.student_auth_initial_password_from_rut(v_student.rut);

  IF v_email IS NULL OR v_pass IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_rut',
      'student_id', p_student_id
    );
  END IF;

  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := public.create_db_user(
      v_email,
      v_pass,
      jsonb_build_object(
        'full_name', trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')),
        'rut', v_student.rut,
        'role', 'alumnos'
      )
    );
    v_created := TRUE;
  END IF;

  INSERT INTO public.app_users (id, email, full_name)
  VALUES (
    v_user_id,
    v_email,
    trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, ''))
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;

  INSERT INTO public.user_roles (user_id, role, first_login, user_name)
  VALUES (
    v_user_id,
    'alumnos',
    TRUE,
    trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, ''))
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'alumnos',
      user_name = EXCLUDED.user_name;

  INSERT INTO public.user_students (user_id, student_id, display_name)
  VALUES (
    v_user_id,
    v_student.id,
    trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, ''))
  )
  ON CONFLICT (user_id, student_id) DO UPDATE
  SET display_name = EXCLUDED.display_name;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  VALUES (
    v_student.tenant_id,
    v_user_id,
    'alumnos',
    'active'
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = 'alumnos',
      status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'created', v_created,
    'student_id', v_student.id,
    'user_id', v_user_id,
    'email', v_email
  );
END;
$$;

-- Batch flow reusing canonical single-student function
CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_student RECORD;
  v_result JSONB;
  v_created INT := 0;
  v_linked INT := 0;
  v_errors INT := 0;
BEGIN
  FOR r_student IN
    SELECT id
    FROM public.students
    WHERE tenant_id = p_tenant_id
      AND rut IS NOT NULL
      AND btrim(rut) <> ''
  LOOP
    BEGIN
      v_result := public.ensure_student_account(r_student.id);

      IF coalesce((v_result->>'success')::boolean, FALSE) = FALSE THEN
        v_errors := v_errors + 1;
      ELSIF coalesce((v_result->>'created')::boolean, FALSE) = TRUE THEN
        v_created := v_created + 1;
      ELSE
        v_linked := v_linked + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE LOG 'Error processing student %: %', r_student.id, SQLERRM;
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

-- Keep legacy function name aligned with canonical email policy
CREATE OR REPLACE FUNCTION public.create_auth_user_from_rut(
  p_rut TEXT,
  p_first_name TEXT,
  p_last_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_pass TEXT;
  v_user_id UUID;
BEGIN
  v_email := public.student_auth_email_from_rut(p_rut);
  v_pass := public.student_auth_initial_password_from_rut(p_rut);

  IF v_email IS NULL OR v_pass IS NULL THEN
    RAISE EXCEPTION 'RUT inválido: %', p_rut;
  END IF;

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
END;
$$;

-- Disable auto-creation trigger to preserve explicit UI flow semantics:
--   - Nuevo Alumno + checkbox => create account
--   - Generar Cuentas Faltantes => batch create accounts
DROP TRIGGER IF EXISTS tr_student_create_auth_account ON public.students;
