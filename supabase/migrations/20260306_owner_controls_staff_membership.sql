/*
  Owner controls staff membership
  -------------------------------
  Solo owner (o superadmin) puede administrar membresías del tenant.
*/

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_members_select ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_insert ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_update ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_delete ON public.tenant_members;

CREATE POLICY tenant_members_select
ON public.tenant_members
FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
);

CREATE POLICY tenant_members_insert
ON public.tenant_members
FOR INSERT
TO public
WITH CHECK (
  auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
);

CREATE POLICY tenant_members_update
ON public.tenant_members
FOR UPDATE
TO public
USING (
  auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
)
WITH CHECK (
  auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
);

CREATE POLICY tenant_members_delete
ON public.tenant_members
FOR DELETE
TO public
USING (
  auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
);
