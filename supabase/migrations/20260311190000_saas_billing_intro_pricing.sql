-- Incremental update for intro pricing, manual review audit and paid cycle count.

alter table public.tenants
  add column if not exists saas_paid_cycle_count integer not null default 0;

alter table public.saas_payment_logs
  add column if not exists pricing_stage text,
  add column if not exists expected_amount numeric(12,2),
  add column if not exists requires_manual_review boolean not null default false;

create index if not exists idx_saas_payment_logs_pricing_stage
  on public.saas_payment_logs (pricing_stage);

create index if not exists idx_saas_payment_logs_manual_review
  on public.saas_payment_logs (requires_manual_review);

drop function if exists public.apply_saas_payment_log(text);

create or replace function public.apply_saas_payment_log(target_payment_id text)
returns table (
  applied boolean,
  valid_until date,
  paid_cycle_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.saas_payment_logs%rowtype;
  v_tenant public.tenants%rowtype;
  v_billing_days integer := 30;
  v_base_date date;
  v_new_valid_until date;
  v_next_cycle_count integer;
begin
  if coalesce(trim(target_payment_id), '') = '' then
    raise exception 'target_payment_id is required';
  end if;

  select *
    into v_log
  from public.saas_payment_logs
  where payment_id = target_payment_id
  for update;

  if not found then
    raise exception 'saas payment log not found for payment_id %', target_payment_id;
  end if;

  select *
    into v_tenant
  from public.tenants
  where id = v_log.tenant_id
  for update;

  if not found then
    raise exception 'tenant % not found', v_log.tenant_id;
  end if;

  if coalesce(v_log.requires_manual_review, false) then
    return query select false, v_tenant.valid_until, v_tenant.saas_paid_cycle_count;
    return;
  end if;

  if v_log.applied_at is not null then
    return query select false, v_tenant.valid_until, v_tenant.saas_paid_cycle_count;
    return;
  end if;

  if v_log.plan_code is not null then
    select billing_days
      into v_billing_days
    from public.saas_plans
    where code = v_log.plan_code;
  end if;

  v_base_date := greatest(current_date, coalesce(v_tenant.valid_until, current_date));
  v_new_valid_until := v_base_date + coalesce(v_billing_days, 30);
  v_next_cycle_count := coalesce(v_tenant.saas_paid_cycle_count, 0) + 1;

  update public.tenants
  set
    subscription_status = 'active',
    valid_until = v_new_valid_until,
    billing_plan_code = coalesce(v_log.plan_code, billing_plan_code),
    saas_paid_cycle_count = v_next_cycle_count,
    last_saas_payment_at = now(),
    updated_at = now()
  where id = v_tenant.id;

  update public.saas_payment_logs
  set
    applied_at = now(),
    updated_at = now()
  where payment_id = target_payment_id;

  return query select true, v_new_valid_until, v_next_cycle_count;
end;
$$;

notify pgrst, 'reload schema';
