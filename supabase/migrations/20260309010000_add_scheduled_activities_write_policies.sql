-- Enable write policies for scheduled_activities

DROP POLICY IF EXISTS scheduled_activities_insert ON public.scheduled_activities;
CREATE POLICY scheduled_activities_insert
ON public.scheduled_activities
FOR INSERT TO authenticated
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS scheduled_activities_update ON public.scheduled_activities;
CREATE POLICY scheduled_activities_update
ON public.scheduled_activities
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

DROP POLICY IF EXISTS scheduled_activities_delete ON public.scheduled_activities;
CREATE POLICY scheduled_activities_delete
ON public.scheduled_activities
FOR DELETE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

notify pgrst, 'reload schema';

