alter table public.credit_movements
  add column if not exists created_by uuid references public.app_users(id) on delete set null;

drop policy if exists meeting_minutes_insert on public.meeting_minutes;
create policy meeting_minutes_insert
on public.meeting_minutes
for insert to authenticated
with check (
  public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
);

drop policy if exists meeting_minutes_update on public.meeting_minutes;
create policy meeting_minutes_update
on public.meeting_minutes
for update to authenticated
using (
  public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
)
with check (
  public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
);

drop policy if exists meeting_minutes_delete on public.meeting_minutes;
create policy meeting_minutes_delete
on public.meeting_minutes
for delete to authenticated
using (
  public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
);

drop policy if exists forms_linked_user_select on public.forms;
create policy forms_linked_user_select
on public.forms
for select to authenticated
using (
  public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
  or (
    is_active = true
    and exists (
      select 1
      from public.user_students us
      join public.students s on s.id = us.student_id
      where us.user_id = auth.uid()
        and s.tenant_id = forms.tenant_id
    )
  )
);

drop policy if exists form_fields_linked_user_select on public.form_fields;
create policy form_fields_linked_user_select
on public.form_fields
for select to authenticated
using (
  exists (
    select 1
    from public.forms f
    where f.id = form_fields.form_id
      and (
        public.rls_is_superadmin(auth.uid())
        or public.rls_is_tenant_member(f.tenant_id, auth.uid())
        or public.rls_is_tenant_owner(f.tenant_id, auth.uid())
        or (
          f.is_active = true
          and exists (
            select 1
            from public.user_students us
            join public.students s on s.id = us.student_id
            where us.user_id = auth.uid()
              and s.tenant_id = f.tenant_id
          )
        )
      )
  )
);

drop policy if exists form_responses_own_select on public.form_responses;
create policy form_responses_own_select
on public.form_responses
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.user_students us
    where us.user_id = auth.uid()
      and us.student_id = form_responses.student_id
  )
  or public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
);

notify pgrst, 'reload schema';
