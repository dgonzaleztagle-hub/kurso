-- Create posts table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  content text not null,
  image_url text,
  is_pinned boolean default false,
  is_official boolean default true,
  status text check (status in ('published', 'draft', 'archived')) default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.posts enable row level security;

-- Policies

-- Read: Visible to all members of the tenant
create policy "Enable read access for tenant members"
on public.posts for select
to authenticated
using (
  exists (
    select 1 from public.tenant_members
    where user_id = auth.uid()
    and tenant_id = posts.tenant_id
  )
);

-- Write (Insert): Only Owner/Admin
create policy "Enable insert for tenant owners and admins"
on public.posts for insert
to authenticated
with check (
  exists (
    select 1 from public.tenant_members
    where user_id = auth.uid()
    and tenant_id = posts.tenant_id
    and role in ('owner', 'admin')
  )
);

-- Write (Update): Only Owner/Admin
create policy "Enable update for tenant owners and admins"
on public.posts for update
to authenticated
using (
  exists (
    select 1 from public.tenant_members
    where user_id = auth.uid()
    and tenant_id = posts.tenant_id
    and role in ('owner', 'admin')
  )
);

-- Write (Delete): Only Owner/Admin
create policy "Enable delete for tenant owners and admins"
on public.posts for delete
to authenticated
using (
  exists (
    select 1 from public.tenant_members
    where user_id = auth.uid()
    and tenant_id = posts.tenant_id
    and role in ('owner', 'admin')
  )
);
