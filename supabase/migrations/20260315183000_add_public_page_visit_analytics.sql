create table if not exists public.page_visit_events (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  title text null,
  referrer text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  visitor_id text not null,
  session_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists page_visit_events_created_at_idx
  on public.page_visit_events (created_at desc);

create index if not exists page_visit_events_path_idx
  on public.page_visit_events (path);

create index if not exists page_visit_events_visitor_id_idx
  on public.page_visit_events (visitor_id);

alter table public.page_visit_events enable row level security;

create policy "page_visit_events_public_insert"
on public.page_visit_events
for insert
to anon, authenticated
with check (true);

create policy "page_visit_events_superadmin_select"
on public.page_visit_events
for select
to authenticated
using (public.auth_is_superadmin());

create or replace function public.get_page_visit_summary(_days integer default 30)
returns table (
  total_visits bigint,
  unique_visitors bigint,
  home_visits bigint,
  seo_visits bigint,
  blog_visits bigint,
  visits_last_7_days bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.auth_is_superadmin() then
    raise exception 'not authorized';
  end if;

  return query
  with scoped as (
    select *
    from public.page_visit_events
    where created_at >= now() - make_interval(days => greatest(_days, 1))
  )
  select
    count(*)::bigint as total_visits,
    count(distinct visitor_id)::bigint as unique_visitors,
    count(*) filter (where path = '/')::bigint as home_visits,
    count(*) filter (
      where path in (
        '/tesoreria-escolar',
        '/gestion-financiera-cursos-escolares',
        '/control-cuotas-curso',
        '/pagos-apoderados',
        '/gastos-e-ingresos-curso',
        '/software-tesorero-de-curso',
        '/tesoreria-escolar-gratis-vs-profesional',
        '/alternativa-a-excel-para-cuotas',
        '/alternativa-a-tesoreroescolar',
        '/como-llevar-la-tesoreria-de-un-curso',
        '/como-cobrar-cuotas-de-curso-sin-whatsapp',
        '/como-rendir-gastos-de-curso-a-apoderados',
        '/errores-comunes-del-tesorero-de-curso',
        '/planilla-vs-software-para-tesoreria-escolar'
      )
    )::bigint as seo_visits,
    count(*) filter (where path like '/blog%')::bigint as blog_visits,
    count(*) filter (where created_at >= now() - interval '7 days')::bigint as visits_last_7_days
  from scoped;
end;
$$;

create or replace function public.get_page_visit_pages(_days integer default 30, _limit integer default 10)
returns table (
  path text,
  visits bigint,
  unique_visitors bigint,
  last_visit timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.auth_is_superadmin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.path,
    count(*)::bigint as visits,
    count(distinct p.visitor_id)::bigint as unique_visitors,
    max(p.created_at) as last_visit
  from public.page_visit_events p
  where p.created_at >= now() - make_interval(days => greatest(_days, 1))
  group by p.path
  order by visits desc, last_visit desc
  limit greatest(_limit, 1);
end;
$$;
