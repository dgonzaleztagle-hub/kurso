create or replace function public.mark_first_login_completed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_roles
  set first_login = false
  where user_id = auth.uid();
end;
$$;

grant execute on function public.mark_first_login_completed() to authenticated;
