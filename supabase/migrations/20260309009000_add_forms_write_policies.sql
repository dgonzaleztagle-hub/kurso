-- Write policies for forms module

-- forms
DROP POLICY IF EXISTS forms_insert ON public.forms;
CREATE POLICY forms_insert
ON public.forms
FOR INSERT TO authenticated
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS forms_update ON public.forms;
CREATE POLICY forms_update
ON public.forms
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

DROP POLICY IF EXISTS forms_delete ON public.forms;
CREATE POLICY forms_delete
ON public.forms
FOR DELETE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

-- form_fields (scope by parent form tenant)
DROP POLICY IF EXISTS form_fields_insert ON public.form_fields;
CREATE POLICY form_fields_insert
ON public.form_fields
FOR INSERT TO authenticated
WITH CHECK (
  exists (
    select 1
    from public.forms f
    where f.id = form_fields.form_id
      and (
        public.rls_is_superadmin(auth.uid())
        or public.rls_is_tenant_member(f.tenant_id, auth.uid())
        or public.rls_is_tenant_owner(f.tenant_id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS form_fields_update ON public.form_fields;
CREATE POLICY form_fields_update
ON public.form_fields
FOR UPDATE TO authenticated
USING (
  exists (
    select 1
    from public.forms f
    where f.id = form_fields.form_id
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
    where f.id = form_fields.form_id
      and (
        public.rls_is_superadmin(auth.uid())
        or public.rls_is_tenant_member(f.tenant_id, auth.uid())
        or public.rls_is_tenant_owner(f.tenant_id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS form_fields_delete ON public.form_fields;
CREATE POLICY form_fields_delete
ON public.form_fields
FOR DELETE TO authenticated
USING (
  exists (
    select 1
    from public.forms f
    where f.id = form_fields.form_id
      and (
        public.rls_is_superadmin(auth.uid())
        or public.rls_is_tenant_member(f.tenant_id, auth.uid())
        or public.rls_is_tenant_owner(f.tenant_id, auth.uid())
      )
  )
);

-- form_responses
DROP POLICY IF EXISTS form_responses_insert ON public.form_responses;
CREATE POLICY form_responses_insert
ON public.form_responses
FOR INSERT TO authenticated
WITH CHECK (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS form_responses_update ON public.form_responses;
CREATE POLICY form_responses_update
ON public.form_responses
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

DROP POLICY IF EXISTS form_responses_delete ON public.form_responses;
CREATE POLICY form_responses_delete
ON public.form_responses
FOR DELETE TO authenticated
USING (
  public.rls_is_superadmin(auth.uid())
  OR public.rls_is_tenant_member(tenant_id, auth.uid())
  OR public.rls_is_tenant_owner(tenant_id, auth.uid())
);

notify pgrst, 'reload schema';
