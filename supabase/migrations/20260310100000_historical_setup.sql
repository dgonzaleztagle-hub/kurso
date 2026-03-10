create table if not exists public.tenant_opening_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  folio integer not null,
  amount numeric(12,2) not null,
  effective_date date not null default current_date,
  notes text,
  status text not null default 'active',
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, folio)
);

create index if not exists idx_tenant_opening_balances_tenant_date
  on public.tenant_opening_balances (tenant_id, effective_date desc);

alter table public.tenant_opening_balances enable row level security;

drop policy if exists tenant_opening_balances_select on public.tenant_opening_balances;
create policy tenant_opening_balances_select
on public.tenant_opening_balances
for select
to authenticated
using (
  public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
);

drop policy if exists tenant_opening_balances_insert on public.tenant_opening_balances;
create policy tenant_opening_balances_insert
on public.tenant_opening_balances
for insert
to authenticated
with check (
  public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
);

drop policy if exists tenant_opening_balances_update on public.tenant_opening_balances;
create policy tenant_opening_balances_update
on public.tenant_opening_balances
for update
to authenticated
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

create or replace function public.get_next_payment_folio_for_tenant(target_tenant_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  with all_folios as (
    select folio::text as folio
    from public.payments
    where tenant_id = target_tenant_id
    union all
    select folio::text as folio
    from public.tenant_opening_balances
    where tenant_id = target_tenant_id
      and coalesce(status, 'active') <> 'reversed'
  )
  select coalesce(max(nullif(regexp_replace(folio, '\D', '', 'g'), '')::integer), 0) + 1
  from all_folios;
$$;

grant execute on function public.get_next_payment_folio_for_tenant(uuid) to authenticated;

notify pgrst, 'reload schema';
