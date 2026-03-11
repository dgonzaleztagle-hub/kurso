-- Harden tenant folio allocation and form_exclusions tenant consistency.

create table if not exists public.tenant_folio_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  scope text not null,
  next_value integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, scope)
);

create or replace function public.bump_tenant_folio_counter(
  target_tenant_id uuid,
  target_scope text,
  requested_count integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := trim(coalesce(target_scope, ''));
  v_requested_count integer := greatest(coalesce(requested_count, 1), 1);
  v_seed integer := 1;
  v_start integer;
begin
  if target_tenant_id is null then
    raise exception 'target_tenant_id is required';
  end if;

  if v_scope = '' then
    raise exception 'target_scope is required';
  end if;

  if v_scope = 'payment' then
    select greatest(
      coalesce(max(nullif(regexp_replace(folio::text, '\D', '', 'g'), '')::integer), 0) + 1,
      coalesce((
        select max(nullif(regexp_replace(tob.folio::text, '\D', '', 'g'), '')::integer) + 1
        from public.tenant_opening_balances tob
        where tob.tenant_id = target_tenant_id
          and coalesce(tob.status, 'active') <> 'reversed'
      ), 1)
    )
    into v_seed
    from public.payments
    where tenant_id = target_tenant_id;
  elsif v_scope = 'expense' then
    select coalesce(max(nullif(regexp_replace(folio::text, '\D', '', 'g'), '')::integer), 0) + 1
    into v_seed
    from public.expenses
    where tenant_id = target_tenant_id;
  elsif v_scope = 'reimbursement' then
    select coalesce(max(nullif(regexp_replace(folio::text, '\D', '', 'g'), '')::integer), 0) + 1
    into v_seed
    from public.reimbursements
    where tenant_id = target_tenant_id;
  else
    raise exception 'unsupported scope %', v_scope;
  end if;

  insert into public.tenant_folio_counters (tenant_id, scope, next_value)
  values (target_tenant_id, v_scope, v_seed + v_requested_count)
  on conflict (tenant_id, scope) do update
  set next_value = public.tenant_folio_counters.next_value + v_requested_count,
      updated_at = now()
  returning next_value - v_requested_count into v_start;

  return v_start;
end;
$$;

create or replace function public.reserve_payment_folios_for_tenant(target_tenant_id uuid, requested_count integer default 1)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.bump_tenant_folio_counter(target_tenant_id, 'payment', requested_count);
$$;

create or replace function public.get_next_payment_folio_for_tenant(target_tenant_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.reserve_payment_folios_for_tenant(target_tenant_id, 1);
$$;

create or replace function public.get_next_expense_folio_for_tenant(target_tenant_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.bump_tenant_folio_counter(target_tenant_id, 'expense', 1);
$$;

create or replace function public.get_next_reimbursement_folio_for_tenant(target_tenant_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.bump_tenant_folio_counter(target_tenant_id, 'reimbursement', 1);
$$;

grant execute on function public.bump_tenant_folio_counter(uuid, text, integer) to authenticated;
grant execute on function public.reserve_payment_folios_for_tenant(uuid, integer) to authenticated;
grant execute on function public.get_next_payment_folio_for_tenant(uuid) to authenticated;
grant execute on function public.get_next_expense_folio_for_tenant(uuid) to authenticated;
grant execute on function public.get_next_reimbursement_folio_for_tenant(uuid) to authenticated;

update public.form_exclusions fe
set tenant_id = f.tenant_id
from public.forms f
where f.id = fe.form_id
  and fe.tenant_id is null;

alter table public.form_exclusions
  alter column tenant_id set not null;

create or replace function public.sync_form_exclusion_tenant_id()
returns trigger
language plpgsql
as $$
declare
  v_form_tenant_id uuid;
  v_student_tenant_id uuid;
begin
  select f.tenant_id
    into v_form_tenant_id
  from public.forms f
  where f.id = new.form_id;

  if v_form_tenant_id is null then
    raise exception 'form % not found', new.form_id;
  end if;

  select s.tenant_id
    into v_student_tenant_id
  from public.students s
  where s.id = new.student_id;

  if v_student_tenant_id is null then
    raise exception 'student % not found', new.student_id;
  end if;

  if v_form_tenant_id <> v_student_tenant_id then
    raise exception 'form_exclusions tenant mismatch: form % belongs to %, student % belongs to %',
      new.form_id,
      v_form_tenant_id,
      new.student_id,
      v_student_tenant_id;
  end if;

  new.tenant_id := v_form_tenant_id;
  return new;
end;
$$;

notify pgrst, 'reload schema';
