-- SaaS billing via Mercado Pago: manual monthly payments for tenant subscriptions.

create table if not exists public.saas_plans (
  code text primary key,
  name text not null,
  description text,
  amount numeric(12,2) not null,
  currency text not null default 'CLP',
  billing_days integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.saas_plans (code, name, description, amount, currency, billing_days, is_active)
values (
  'kurso_monthly_v1',
  'Kurso Mensual',
  'Plan mensual manual Kurso v1',
  9990,
  'CLP',
  30,
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  amount = excluded.amount,
  currency = excluded.currency,
  billing_days = excluded.billing_days,
  is_active = excluded.is_active;

alter table public.tenants
  add column if not exists billing_plan_code text references public.saas_plans(code),
  add column if not exists last_saas_payment_at timestamptz,
  add column if not exists saas_paid_cycle_count integer not null default 0;

create table if not exists public.saas_payment_logs (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_code text references public.saas_plans(code),
  pricing_stage text,
  external_reference text,
  status text not null,
  status_detail text,
  amount numeric(12,2),
  expected_amount numeric(12,2),
  currency text,
  payment_method text,
  payer_email text,
  requires_manual_review boolean not null default false,
  raw_data jsonb not null default '{}'::jsonb,
  webhook_payload jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saas_payment_logs_tenant_created_at
  on public.saas_payment_logs (tenant_id, created_at desc);

create index if not exists idx_saas_payment_logs_status
  on public.saas_payment_logs (status);

create index if not exists idx_saas_payment_logs_payer_email
  on public.saas_payment_logs (payer_email);

create index if not exists idx_saas_payment_logs_plan_code
  on public.saas_payment_logs (plan_code);

create index if not exists idx_saas_payment_logs_pricing_stage
  on public.saas_payment_logs (pricing_stage);

create index if not exists idx_saas_payment_logs_manual_review
  on public.saas_payment_logs (requires_manual_review);

alter table public.saas_plans enable row level security;
alter table public.saas_payment_logs enable row level security;

drop policy if exists saas_plans_select on public.saas_plans;
create policy saas_plans_select
on public.saas_plans
for select
to authenticated
using (true);

drop policy if exists saas_payment_logs_select on public.saas_payment_logs;
create policy saas_payment_logs_select
on public.saas_payment_logs
for select
to authenticated
using (
  public.rls_is_superadmin(auth.uid())
  or public.rls_is_tenant_member(tenant_id, auth.uid())
  or public.rls_is_tenant_owner(tenant_id, auth.uid())
);

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

grant execute on function public.apply_saas_payment_log(text) to authenticated;

notify pgrst, 'reload schema';
