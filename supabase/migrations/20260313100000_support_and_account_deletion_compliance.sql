create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_type text not null default 'support',
  status text not null default 'open',
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  source text not null default 'web',
  tenant_id uuid references public.tenants(id) on delete set null,
  tenant_name text,
  user_id uuid references public.app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.support_requests is 'Solicitudes de soporte, privacidad y revision enviadas desde la web/app.';
comment on column public.support_requests.request_type is 'support, payments, credits, security, privacy, arco_access, arco_rectification, arco_cancellation, arco_opposition, account_deletion';

create index if not exists idx_support_requests_created_at
  on public.support_requests (created_at desc);

create index if not exists idx_support_requests_request_type
  on public.support_requests (request_type, status);

create index if not exists idx_support_requests_user_id
  on public.support_requests (user_id);

alter table public.support_requests enable row level security;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'processed',
  auth_user_id uuid,
  tenant_id uuid references public.tenants(id) on delete set null,
  email_before_deletion text,
  role_before_deletion text,
  deletion_mode text not null default 'anonymize_and_auth_delete',
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.account_deletion_requests is 'Registro interno del proceso de eliminacion/anonimizacion de cuentas solicitado desde la app.';

create index if not exists idx_account_deletion_requests_created_at
  on public.account_deletion_requests (created_at desc);

create index if not exists idx_account_deletion_requests_auth_user_id
  on public.account_deletion_requests (auth_user_id);

alter table public.account_deletion_requests enable row level security;
