create table if not exists public.saas_promo_codes (
  code text primary key,
  description text,
  active boolean not null default true,
  fixed_amount numeric(12,2) not null,
  max_redemptions integer not null default 1,
  allowed_pricing_stages text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code text not null references public.saas_promo_codes(code) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  checkout_reference text not null unique,
  payment_id text unique,
  status text not null default 'checkout_created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create unique index if not exists idx_saas_promo_redemptions_active_code
  on public.saas_promo_redemptions (promo_code)
  where status in ('checkout_created', 'approved');

create index if not exists idx_saas_promo_redemptions_tenant
  on public.saas_promo_redemptions (tenant_id, created_at desc);

alter table public.saas_payment_logs
  add column if not exists promo_code text,
  add column if not exists promo_redemption_id uuid;

alter table public.saas_payment_logs
  drop constraint if exists saas_payment_logs_promo_redemption_id_fkey;

alter table public.saas_payment_logs
  add constraint saas_payment_logs_promo_redemption_id_fkey
  foreign key (promo_redemption_id)
  references public.saas_promo_redemptions(id)
  on delete set null;

create index if not exists idx_saas_payment_logs_promo_code
  on public.saas_payment_logs (promo_code);

insert into public.saas_promo_codes (
  code,
  description,
  active,
  fixed_amount,
  max_redemptions,
  allowed_pricing_stages
)
values (
  'QA10',
  'Codigo interno de prueba para activar el primer cobro a $10 una sola vez.',
  true,
  10,
  1,
  array['trial_conversion', 'intro_renewal']
)
on conflict (code) do update
set
  description = excluded.description,
  active = excluded.active,
  fixed_amount = excluded.fixed_amount,
  max_redemptions = excluded.max_redemptions,
  allowed_pricing_stages = excluded.allowed_pricing_stages,
  updated_at = now();

alter table public.saas_promo_codes enable row level security;
alter table public.saas_promo_redemptions enable row level security;

drop policy if exists saas_promo_codes_select on public.saas_promo_codes;
create policy saas_promo_codes_select
on public.saas_promo_codes
for select
to authenticated
using (public.rls_is_superadmin(auth.uid()));

drop policy if exists saas_promo_redemptions_select on public.saas_promo_redemptions;
create policy saas_promo_redemptions_select
on public.saas_promo_redemptions
for select
to authenticated
using (public.rls_is_superadmin(auth.uid()));

notify pgrst, 'reload schema';
