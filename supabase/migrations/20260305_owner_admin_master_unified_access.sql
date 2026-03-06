/*
  Owner/Admin/Master Unified Access
  --------------------------------
  Objetivo:
  - Evitar bloqueos funcionales cuando el usuario principal queda como `owner`.
  - Alinear backend con la regla de negocio: owner/admin/master gestionan el tenant.
  - Aplicar sobre tablas críticas de operación diaria.
*/

DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  table_exists BOOLEAN;
  has_tenant_id BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'expenses',
    'payment_notifications',
    'reimbursements',
    'dashboard_notifications'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO table_exists;

    IF NOT table_exists THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'tenant_id'
    ) INTO has_tenant_id;

    IF NOT has_tenant_id THEN
      CONTINUE;
    END IF;

    policy_name := format('Unified %s tenant access', tbl);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, tbl);

    EXECUTE format($sql$
      CREATE POLICY %I
      ON public.%I
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = %I.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role IN ('owner', 'admin', 'master')
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = %I.tenant_id
            AND t.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = %I.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role IN ('owner', 'admin', 'master')
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = %I.tenant_id
            AND t.owner_id = auth.uid()
        )
      );
    $sql$, policy_name, tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;
