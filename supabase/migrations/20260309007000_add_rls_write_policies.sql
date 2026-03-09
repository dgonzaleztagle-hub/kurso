-- Enable write policies for tenant-scoped tables used by app flows

-- activity_donations
DROP POLICY IF EXISTS activity_donations_insert ON public.activity_donations;
CREATE POLICY activity_donations_insert
ON public.activity_donations
FOR INSERT TO authenticated
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS activity_donations_update ON public.activity_donations;
CREATE POLICY activity_donations_update
ON public.activity_donations
FOR UPDATE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
)
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS activity_donations_delete ON public.activity_donations;
CREATE POLICY activity_donations_delete
ON public.activity_donations
FOR DELETE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

-- activity_exclusions
DROP POLICY IF EXISTS activity_exclusions_insert ON public.activity_exclusions;
CREATE POLICY activity_exclusions_insert
ON public.activity_exclusions
FOR INSERT TO authenticated
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS activity_exclusions_update ON public.activity_exclusions;
CREATE POLICY activity_exclusions_update
ON public.activity_exclusions
FOR UPDATE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
)
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS activity_exclusions_delete ON public.activity_exclusions;
CREATE POLICY activity_exclusions_delete
ON public.activity_exclusions
FOR DELETE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

-- scheduled_activity_exclusions
DROP POLICY IF EXISTS scheduled_activity_exclusions_insert ON public.scheduled_activity_exclusions;
CREATE POLICY scheduled_activity_exclusions_insert
ON public.scheduled_activity_exclusions
FOR INSERT TO authenticated
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS scheduled_activity_exclusions_update ON public.scheduled_activity_exclusions;
CREATE POLICY scheduled_activity_exclusions_update
ON public.scheduled_activity_exclusions
FOR UPDATE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
)
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS scheduled_activity_exclusions_delete ON public.scheduled_activity_exclusions;
CREATE POLICY scheduled_activity_exclusions_delete
ON public.scheduled_activity_exclusions
FOR DELETE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

notify pgrst, 'reload schema';
