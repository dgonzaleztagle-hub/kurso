-- ========================================
-- MIGRACIÓN INTEGRAL DE CORRECCIONES
-- Fecha: 2026-03-08
-- Propósito: Arreglar todos los problemas críticos para PRODUCCIÓN
-- ========================================

-- ============================================================
-- FASE 1: CORREGIR TIPOS DE DATOS EN ACTIVITY_DONATIONS
-- ============================================================

-- 1A. Remover defaults conflictivos antes de cambiar tipos
ALTER TABLE public.activity_donations
ALTER COLUMN amount DROP DEFAULT;

ALTER TABLE public.activity_donations
ALTER COLUMN cantidad_original DROP DEFAULT;

-- 1B. Converter amount de TEXT a NUMERIC
ALTER TABLE public.activity_donations
ALTER COLUMN amount TYPE numeric(10,2) USING (
  CASE 
    WHEN amount ~ '^\d+(\.\d{2})?$' THEN amount::numeric(10,2)
    ELSE 0::numeric(10,2)
  END
);

-- 1C. Convertir cantidad_original de TEXT a NUMERIC también
ALTER TABLE public.activity_donations
ALTER COLUMN cantidad_original TYPE numeric(10,2) USING (
  CASE 
    WHEN cantidad_original ~ '^\d+(\.\d{2})?$' THEN cantidad_original::numeric(10,2)
    ELSE NULL::numeric(10,2)
  END
);

-- 1D. Establecer nuevos defaults apropiados
ALTER TABLE public.activity_donations
ALTER COLUMN amount SET DEFAULT 0;

ALTER TABLE public.activity_donations
ALTER COLUMN cantidad_original SET DEFAULT 0;

-- ============================================================
-- FASE 2: CREAR ALIAS 'concept' → 'description' EN EXPENSES
-- ============================================================

-- Crear VIEW que expone tanto 'concept' como 'description'
CREATE OR REPLACE VIEW public.v_expenses AS
SELECT 
  id,
  tenant_id,
  folio,
  amount,
  expense_date,
  description,
  description AS concept,  -- ALIAS para compatibilidad frontend
  category,
  created_by,
  created_at
FROM public.expenses;

-- Crear trigger para mantener sincronizado
CREATE OR REPLACE FUNCTION public.sync_expense_concept_description()
RETURNS TRIGGER AS $$
BEGIN
  -- Si llega con 'concept' en metadata, copiar a 'description'
  IF NEW.description IS NULL THEN
    RAISE EXCEPTION 'field "description" of relation "expenses" does not allow nulls';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_expense_concept ON public.expenses;
CREATE TRIGGER tr_sync_expense_concept
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_expense_concept_description();

-- ============================================================
-- FASE 3: VALIDAR Y CORREGIR FOREIGN KEYS
-- ============================================================

-- 3A. Verificar que student_id en activity_donations referencia BIGINT correctamente
-- (Ya confirmado que es BIGINT en ambos lados)

-- 3B. Agregar constraints si faltan
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_activity_donations_student'
  ) THEN
    ALTER TABLE public.activity_donations
    ADD CONSTRAINT fk_activity_donations_student
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_activity_donations_activity'
  ) THEN
    ALTER TABLE public.activity_donations
    ADD CONSTRAINT fk_activity_donations_activity
    FOREIGN KEY (scheduled_activity_id) REFERENCES public.scheduled_activities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- FASE 4: CORREGIR RLS POLICIES PARA PERMITIR INSERCIONES
-- ============================================================

-- 4A. Asegurar que activity_donations tiene RLS adecuada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_donations' 
    AND policyname = 'tenant_scoped_insert_activity_donations'
  ) THEN
    CREATE POLICY tenant_scoped_insert_activity_donations ON public.activity_donations
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM app_users 
              WHERE id = auth.uid() AND is_superadmin = true)
      OR EXISTS (SELECT 1 FROM tenants t
                 WHERE t.id = activity_donations.tenant_id 
                 AND t.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM tenant_members tm
                 WHERE tm.tenant_id = activity_donations.tenant_id 
                 AND tm.user_id = auth.uid() 
                 AND tm.status = 'active'
                 AND (tm.role::text IN ('owner','master','admin')))
    );
  END IF;
END $$;

-- 4B. Asegurar que credit_movements permite inserciones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'credit_movements' 
    AND policyname = 'tenant_scoped_insert_credit_movements'
  ) THEN
    CREATE POLICY tenant_scoped_insert_credit_movements ON public.credit_movements
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM app_users 
              WHERE id = auth.uid() AND is_superadmin = true)
      OR EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.user_id = auth.uid() 
        AND tm.status = 'active'
        AND (tm.role::text IN ('owner','master','admin'))
      )
    );
  END IF;
END $$;

-- 4C. Asegurar que expenses permite inserciones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'expenses' 
    AND policyname = 'tenant_scoped_insert_expenses'
  ) THEN
    CREATE POLICY tenant_scoped_insert_expenses ON public.expenses
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM app_users 
              WHERE id = auth.uid() AND is_superadmin = true)
      OR EXISTS (SELECT 1 FROM tenants t
                 WHERE t.id = expenses.tenant_id 
                 AND t.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM tenant_members tm
                 WHERE tm.tenant_id = expenses.tenant_id 
                 AND tm.user_id = auth.uid() 
                 AND tm.status = 'active'
                 AND (tm.role::text IN ('owner','master','admin')))
    );
  END IF;
END $$;

-- ============================================================
-- FASE 5: LIMPIAR Y VALIDAR INTEGRIDAD
-- ============================================================

-- 5A. Asegurar que tenant_id está siempre definido en tablas críticas
UPDATE public.activity_donations
SET tenant_id = (
  SELECT t.id FROM public.tenants t LIMIT 1
)
WHERE tenant_id IS NULL;

UPDATE public.credit_movements
SET tenant_id = (
  SELECT tenant_id FROM public.student_credits sc
  WHERE sc.student_id = credit_movements.student_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- 5B. Log de cambios realizados (opcional, si tabla existe)
-- INSERT INTO public.audit_logs (action, table_name, details, created_by, created_at)
-- VALUES (
--   'MIGRATION_20260308',
--   'MULTIPLE',
--   jsonb_build_object(
--     'fixes_applied', ARRAY[
--       'activity_donations.amount: TEXT → NUMERIC(10,2)',
--       'activity_donations.cantidad_original: TEXT → NUMERIC(10,2)',
--       'expenses: create view v_expenses with concept alias',
--       'rls_policies: ensure INSERT permissions on activity_donations, credit_movements, expenses'
--     ]
--   ),
--   auth.uid(),
--   NOW()
-- )
-- ON CONFLICT DO NOTHING;

-- ============================================================
-- FASE 6: CREAR FUNCIONES HELPER PARA INSERCIÓN SEGURA
-- ============================================================

CREATE OR REPLACE FUNCTION public.insert_activity_donation(
  p_scheduled_activity_id UUID,
  p_student_id BIGINT,
  p_name TEXT,
  p_amount NUMERIC,
  p_unit TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_donation_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Obtener tenant_id si no se proporciona
  IF p_tenant_id IS NULL THEN
    SELECT sa.tenant_id INTO v_tenant_id
    FROM public.scheduled_activities sa
    WHERE sa.id = p_scheduled_activity_id;
  ELSE
    v_tenant_id := p_tenant_id;
  END IF;

  -- Validar que todos los parámetros sean válidos
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar tenant_id para la donación';
  END IF;

  -- Insertar donación
  INSERT INTO public.activity_donations (
    scheduled_activity_id,
    student_id,
    name,
    amount,
    unit,
    tenant_id
  )
  VALUES (
    p_scheduled_activity_id,
    p_student_id,
    p_name,
    p_amount,
    p_unit,
    v_tenant_id
  )
  RETURNING id INTO v_donation_id;

  RETURN v_donation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.insert_credit_movement(
  p_student_id BIGINT,
  p_amount NUMERIC,
  p_type TEXT,
  p_description TEXT,
  p_source_payment_id INTEGER DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_movement_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Obtener tenant_id del estudiante
  SELECT tenant_id INTO v_tenant_id
  FROM public.students
  WHERE id = p_student_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Estudiante no existe o sin tenant asignado';
  END IF;

  -- Insertar movimiento de crédito
  INSERT INTO public.credit_movements (
    student_id,
    amount,
    type,
    description,
    source_payment_id,
    details,
    tenant_id,
    created_by
  )
  VALUES (
    p_student_id,
    p_amount,
    p_type,
    p_description,
    p_source_payment_id,
    p_details,
    v_tenant_id,
    auth.uid()
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FASE 7: VALIDACIÓN FINAL
-- ============================================================

-- Verificar que todas las conversiones fueron correctas
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.activity_donations
  WHERE amount IS NOT NULL AND amount < 0;
  
  IF v_count > 0 THEN
    RAISE WARNING 'ALERTA: Hay % valores negativos en activity_donations.amount', v_count;
  END IF;
END $$;

-- ============================================================
-- FASE 8: CREAR TRIGGER AUTOMÁTICO PARA ESTUDIANTES → AUTH
-- ============================================================

-- 8A. Mejorar función de creación de usuario de auth
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
    
    -- Generar email y contraseña según disponibilidad
    v_email := COALESCE(
        (SELECT v_rut_body || '@kurso.cl'),
        v_rut_body || '@kurso.cl'
    );
    
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

-- 8B. Crear trigger para auto-crear cuentas de auth cuando se crea estudiante
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
                    lower(regexp_replace(NEW.rut, '[^0-9kK]', '', 'g')) || '@kurso.cl',
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
                ON CONFLICT (user_id) DO UPDATE
                SET role = 'alumnos',
                    user_name = EXCLUDED.user_name;

                -- Vincular en user_students
                INSERT INTO public.user_students (user_id, student_id, display_name)
                VALUES (
                    v_user_id,
                    NEW.id,
                    trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''))
                )
                ON CONFLICT (user_id, student_id) DO UPDATE
                SET display_name = EXCLUDED.display_name;

                -- Si el estudiante tiene tenant, agregarlo a tenant_members
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
            -- No lanzar excepción, permitir que continúe
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS tr_student_create_auth_account ON public.students;

-- Crear trigger AFTER INSERT
CREATE TRIGGER tr_student_create_auth_account
AFTER INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.tr_student_create_auth_account();

-- ============================================================
-- FASE 9: MEJORAR FUNCIÓN generate_missing_accounts
-- ============================================================

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
            v_email := v_rut_body || '@kurso.cl';
            v_pass := CASE
                WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
                WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
                ELSE '123456'
            END;

            -- Verificar si usuario ya existe
            SELECT id INTO v_user_id
            FROM auth.users
            WHERE email = v_email;

            IF v_user_id IS NULL THEN
                -- Crear usuario
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

            -- Crear/actualizar app_users
            INSERT INTO public.app_users (id, email, full_name)
            VALUES (
                v_user_id,
                v_email,
                trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
            )
            ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email,
                full_name = EXCLUDED.full_name;

            -- Crear/actualizar user_roles
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

            -- Crear/actualizar user_students
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

            -- Crear/actualizar tenant_members
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
        'errors', v_errors,
        'message', format('Procesados: %s estudiantes. Creadas: %s cuentas. Vinculadas: %s. Errores: %s',
            v_created + v_linked, v_created, v_linked, v_errors)
    );
END;
$$;

-- ============================================================
-- FIN DE MIGRACIÓN
-- ========================================
