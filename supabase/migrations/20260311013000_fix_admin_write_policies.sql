-- Allow tenant operators to update payment notifications and tenant settings.

DROP POLICY IF EXISTS payment_notifications_operator_all ON public.payment_notifications;
CREATE POLICY payment_notifications_operator_all
ON public.payment_notifications
FOR ALL
TO authenticated
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

DROP POLICY IF EXISTS tenants_owner_update ON public.tenants;
CREATE POLICY tenants_owner_update
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenants.id
      AND tm.user_id = auth.uid()
      AND COALESCE(tm.status, 'active') = 'active'
      AND tm.role::text IN ('owner', 'master', 'admin')
  )
)
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenants.id
      AND tm.user_id = auth.uid()
      AND COALESCE(tm.status, 'active') = 'active'
      AND tm.role::text IN ('owner', 'master', 'admin')
  )
);
