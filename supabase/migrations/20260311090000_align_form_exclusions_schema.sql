-- Align form_exclusions with current client contract while preserving tenant-scoped reads.

alter table public.form_exclusions
  add column if not exists created_by uuid references public.app_users(id) on delete set null;

alter table public.form_exclusions
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.form_exclusions
  alter column tenant_id drop not null;

update public.form_exclusions fe
set tenant_id = f.tenant_id
from public.forms f
where f.id = fe.form_id
  and fe.tenant_id is null;

create or replace function public.sync_form_exclusion_tenant_id()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is null then
    select f.tenant_id
      into new.tenant_id
    from public.forms f
    where f.id = new.form_id;
  end if;

  return new;
end;
$$;

drop trigger if exists form_exclusions_sync_tenant_id on public.form_exclusions;

create trigger form_exclusions_sync_tenant_id
before insert or update of form_id, tenant_id
on public.form_exclusions
for each row
execute function public.sync_form_exclusion_tenant_id();
