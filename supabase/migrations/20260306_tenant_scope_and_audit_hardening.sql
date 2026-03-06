/*
  Tenant scope + audit hardening
  ------------------------------
  Objetivo:
  - Evitar cruces entre tenants en tablas operativas.
  - Mantener acceso de operación para owner/admin/master por tenant.
  - Mantener superadmin global.
  - Activar trazabilidad consistente en audit_logs.
*/

-- =============================
-- 1) RLS tenant-scoped (core)
-- =============================
DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'activities',
    'activity_donations',
    'dashboard_notifications',
    'expenses',
    'forms',
    'payment_notifications',
    'payments',
    'reimbursements',
    'scheduled_activities'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
    END LOOP;

    EXECUTE format($sql$
      CREATE POLICY %I
      ON public.%I
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.app_users au
          WHERE au.id = auth.uid()
            AND au.is_superadmin = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = %I.tenant_id
            AND t.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = %I.tenant_id
            AND tm.user_id = auth.uid()
            AND coalesce(tm.status, 'active') = 'active'
            AND tm.role::text IN ('owner', 'master', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.app_users au
          WHERE au.id = auth.uid()
            AND au.is_superadmin = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = %I.tenant_id
            AND t.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = %I.tenant_id
            AND tm.user_id = auth.uid()
            AND coalesce(tm.status, 'active') = 'active'
            AND tm.role::text IN ('owner', 'master', 'admin')
        )
      );
    $sql$, format('tenant_scoped_operator_access_%s', tbl), tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- form_fields no tiene tenant_id, se evalúa por forms.form_id
DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'form_fields'
  ) THEN
    ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'form_fields'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.form_fields;', pol.policyname);
    END LOOP;

    CREATE POLICY tenant_scoped_operator_access_form_fields
    ON public.form_fields
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.app_users au
        WHERE au.id = auth.uid()
          AND au.is_superadmin = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.forms f
        JOIN public.tenants t ON t.id = f.tenant_id
        WHERE f.id = form_fields.form_id
          AND t.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.forms f
        JOIN public.tenant_members tm ON tm.tenant_id = f.tenant_id
        WHERE f.id = form_fields.form_id
          AND tm.user_id = auth.uid()
          AND coalesce(tm.status, 'active') = 'active'
          AND tm.role::text IN ('owner', 'master', 'admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.app_users au
        WHERE au.id = auth.uid()
          AND au.is_superadmin = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.forms f
        JOIN public.tenants t ON t.id = f.tenant_id
        WHERE f.id = form_fields.form_id
          AND t.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.forms f
        JOIN public.tenant_members tm ON tm.tenant_id = f.tenant_id
        WHERE f.id = form_fields.form_id
          AND tm.user_id = auth.uid()
          AND coalesce(tm.status, 'active') = 'active'
          AND tm.role::text IN ('owner', 'master', 'admin')
      )
    );
  END IF;
END $$;

-- ====================================
-- 2) Auditoría automática consistente
-- ====================================
CREATE OR REPLACE FUNCTION public.log_table_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_record_id text;
  v_payload jsonb;
  v_row jsonb;
BEGIN
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN NULL;
  END IF;

  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_payload := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := to_jsonb(NEW);
    v_payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_row := to_jsonb(NEW);
    v_payload := jsonb_build_object('new', to_jsonb(NEW));
  END IF;

  IF v_row ? 'tenant_id' THEN
    BEGIN
      v_tenant_id := NULLIF(v_row->>'tenant_id', '')::uuid;
    EXCEPTION WHEN others THEN
      v_tenant_id := NULL;
    END;
  END IF;

  v_record_id := COALESCE(v_row->>'id', NULL);

  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    action,
    table_name,
    record_id,
    payload
  ) VALUES (
    v_tenant_id,
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_payload
  );

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  tbl text;
  trg_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'activities',
    'dashboard_notifications',
    'expenses',
    'forms',
    'meeting_minutes',
    'payment_notifications',
    'payments',
    'posts',
    'reimbursements',
    'scheduled_activities',
    'student_credits',
    'students',
    'tenant_members',
    'user_roles',
    'credit_movements'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    trg_name := format('trg_audit_%s', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', trg_name, tbl);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_table_audit_event();',
      trg_name,
      tbl
    );
  END LOOP;
END $$;
