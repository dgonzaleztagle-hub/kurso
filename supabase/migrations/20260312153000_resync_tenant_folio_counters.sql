-- Re-sync tenant folio counters with the current database state.
-- This fixes counters that may have been initialized before deleting test data
-- or before importing historical records.

insert into public.tenant_folio_counters (tenant_id, scope, next_value)
select
  tenant_id,
  scope,
  next_value
from (
  select
    p.tenant_id,
    'payment'::text as scope,
    greatest(
      coalesce(max(nullif(regexp_replace(p.folio::text, '\D', '', 'g'), '')::integer), 0) + 1,
      coalesce((
        select max(nullif(regexp_replace(tob.folio::text, '\D', '', 'g'), '')::integer) + 1
        from public.tenant_opening_balances tob
        where tob.tenant_id = p.tenant_id
          and coalesce(tob.status, 'active') <> 'reversed'
      ), 1)
    ) as next_value
  from public.payments p
  group by p.tenant_id

  union all

  select
    e.tenant_id,
    'expense'::text as scope,
    coalesce(max(nullif(regexp_replace(e.folio::text, '\D', '', 'g'), '')::integer), 0) + 1 as next_value
  from public.expenses e
  group by e.tenant_id

  union all

  select
    r.tenant_id,
    'reimbursement'::text as scope,
    coalesce(max(nullif(regexp_replace(r.folio::text, '\D', '', 'g'), '')::integer), 0) + 1 as next_value
  from public.reimbursements r
  group by r.tenant_id
) seeded
on conflict (tenant_id, scope) do update
set next_value = excluded.next_value,
    updated_at = now();

notify pgrst, 'reload schema';
