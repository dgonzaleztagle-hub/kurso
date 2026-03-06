/*
  Fix Core RLS for Owner/Admin/Master
  -----------------------------------
  Objetivo:
  - Evitar bloqueos RLS en módulos críticos reportados:
    payments, expenses, dashboard_notifications, activities, forms, form_fields.
  - No depender de funciones legacy como has_role() para autorizar operaciones internas.
*/

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'payments',
    'expenses',
    'dashboard_notifications',
    'activities',
    'forms',
    'form_fields'
  ]
  LOOP
    -- Skip if table does not exist.
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    -- Drop all previous policies on this table to avoid contradictory legacy checks.
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
    END LOOP;

    -- Unified access policy for internal app operators.
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
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role::text IN ('owner', 'master', 'admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.user_id = auth.uid()
            AND COALESCE(tm.status, 'active') = 'active'
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
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role::text IN ('owner', 'master', 'admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.user_id = auth.uid()
            AND COALESCE(tm.status, 'active') = 'active'
            AND tm.role::text IN ('owner', 'master', 'admin')
        )
      );
    $sql$, format('Unified operator access %s', tbl), tbl);
  END LOOP;
END $$;

