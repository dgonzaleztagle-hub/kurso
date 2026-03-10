create or replace function public.get_next_payment_folio_for_tenant(target_tenant_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(max(folio), 0) + 1
  from public.payments
  where tenant_id = target_tenant_id;
$$;

create or replace function public.get_next_expense_folio_for_tenant(target_tenant_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(max(folio), 0) + 1
  from public.expenses
  where tenant_id = target_tenant_id;
$$;

create or replace function public.get_next_reimbursement_folio_for_tenant(target_tenant_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(max(folio), 0) + 1
  from public.reimbursements
  where tenant_id = target_tenant_id;
$$;

grant execute on function public.get_next_payment_folio_for_tenant(uuid) to authenticated;
grant execute on function public.get_next_expense_folio_for_tenant(uuid) to authenticated;
grant execute on function public.get_next_reimbursement_folio_for_tenant(uuid) to authenticated;

notify pgrst, 'reload schema';
