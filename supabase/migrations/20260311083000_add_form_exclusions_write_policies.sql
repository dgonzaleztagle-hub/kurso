-- Write policies for form_exclusions, scoped by parent form tenant

DROP POLICY IF EXISTS form_exclusions_insert ON public.form_exclusions;
CREATE POLICY form_exclusions_insert
ON public.form_exclusions
FOR INSERT TO authenticated
WITH CHECK (
  exists (
    select 1
    from public.forms f
    where f.id = form_exclusions.form_id
      and (
        public.rls_is_superadmin(auth.uid())
        or public.rls_is_tenant_member(f.tenant_id, auth.uid())
        or public.rls_is_tenant_owner(f.tenant_id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS form_exclusions_update ON public.form_exclusions;
CREATE POLICY form_exclusions_update
ON public.form_exclusions
FOR UPDATE TO authenticated
USING (
  exists (
    select 1
    from public.forms f
    where f.id = form_exclusions.form_id
      and (
        public.rls_is_superadmin(auth.uid())
        or public.rls_is_tenant_member(f.tenant_id, auth.uid())
        or public.rls_is_tenant_owner(f.tenant_id, auth.uid())
      )
  )
)
WITH CHECK (
  exists (
    select 1
    from public.forms f
    where f.id = form_exclusions.form_id
      and (
        public.rls_is_superadmin(auth.uid())
        or public.rls_is_tenant_member(f.tenant_id, auth.uid())
        or public.rls_is_tenant_owner(f.tenant_id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS form_exclusions_delete ON public.form_exclusions;
CREATE POLICY form_exclusions_delete
ON public.form_exclusions
FOR DELETE TO authenticated
USING (
  exists (
    select 1
    from public.forms f
    where f.id = form_exclusions.form_id
      and (
        public.rls_is_superadmin(auth.uid())
        or public.rls_is_tenant_member(f.tenant_id, auth.uid())
        or public.rls_is_tenant_owner(f.tenant_id, auth.uid())
      )
  )
);

notify pgrst, 'reload schema';
