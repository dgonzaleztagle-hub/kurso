alter table public.support_requests
  add column if not exists requester_user_id uuid references public.app_users(id) on delete set null,
  add column if not exists requester_email_normalized text,
  add column if not exists requester_role text,
  add column if not exists assigned_owner_user_id uuid references public.app_users(id) on delete set null,
  add column if not exists visibility_mode text,
  add column if not exists last_message_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_id uuid references public.app_users(id) on delete set null,
  add column if not exists external_reply_note text,
  add column if not exists last_external_reply_at timestamptz;

update public.support_requests
set
  requester_user_id = coalesce(requester_user_id, user_id),
  requester_email_normalized = coalesce(requester_email_normalized, lower(email)),
  visibility_mode = coalesce(
    visibility_mode,
    case
      when coalesce(user_id, requester_user_id) is null then 'public_email_only'
      else 'authenticated_thread'
    end
  ),
  last_message_at = coalesce(last_message_at, created_at),
  assigned_owner_user_id = coalesce(
    assigned_owner_user_id,
    (
      select t.owner_id
      from public.tenants t
      where t.id = public.support_requests.tenant_id
    )
  )
where true;

alter table public.support_requests
  alter column visibility_mode set default 'public_email_only';

create table if not exists public.support_request_messages (
  id uuid primary key default gen_random_uuid(),
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  author_user_id uuid references public.app_users(id) on delete set null,
  author_role text not null,
  body text not null
);

comment on table public.support_request_messages is 'Mensajes internos del hilo de soporte para tickets autenticados.';

create index if not exists idx_support_request_messages_ticket_created_at
  on public.support_request_messages (support_request_id, created_at asc);

create index if not exists idx_support_requests_visibility_status
  on public.support_requests (visibility_mode, status, last_message_at desc);

create index if not exists idx_support_requests_requester_email
  on public.support_requests (requester_email_normalized);

create index if not exists idx_support_requests_requester_user
  on public.support_requests (requester_user_id);

create index if not exists idx_support_requests_assigned_owner
  on public.support_requests (assigned_owner_user_id);

alter table public.support_request_messages enable row level security;

insert into public.support_request_messages (
  support_request_id,
  created_at,
  author_user_id,
  author_role,
  body
)
select
  sr.id,
  sr.created_at,
  coalesce(sr.requester_user_id, sr.user_id),
  coalesce(sr.requester_role, case when sr.visibility_mode = 'authenticated_thread' then 'guardian' else 'public' end),
  sr.message
from public.support_requests sr
where sr.visibility_mode = 'authenticated_thread'
  and not exists (
    select 1
    from public.support_request_messages srm
    where srm.support_request_id = sr.id
  );
