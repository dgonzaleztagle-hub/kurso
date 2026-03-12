create or replace function public.approve_reimbursement_transaction(
  target_reimbursement_id uuid,
  target_processed_by uuid,
  payment_proof_files jsonb default '[]'::jsonb
)
returns table (
  reimbursement_id uuid,
  expense_folio integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reimbursement public.reimbursements%rowtype;
  v_expense_folio integer;
  v_supplier text;
  v_description text;
  v_payment_proof jsonb;
begin
  if target_reimbursement_id is null then
    raise exception 'target_reimbursement_id is required';
  end if;

  if target_processed_by is null then
    raise exception 'target_processed_by is required';
  end if;

  if payment_proof_files is null then
    v_payment_proof := '[]'::jsonb;
  elsif jsonb_typeof(payment_proof_files) <> 'array' then
    raise exception 'payment_proof_files must be an array';
  else
    v_payment_proof := payment_proof_files;
  end if;

  select *
    into v_reimbursement
  from public.reimbursements
  where id = target_reimbursement_id
  for update;

  if not found then
    raise exception 'reimbursement % not found', target_reimbursement_id;
  end if;

  if coalesce(v_reimbursement.status, 'pending') <> 'pending' then
    raise exception 'reimbursement % is already processed', target_reimbursement_id;
  end if;

  if v_reimbursement.expense_folio is not null then
    v_expense_folio := v_reimbursement.expense_folio;
  else
    v_expense_folio := public.get_next_expense_folio_for_tenant(v_reimbursement.tenant_id);
    v_supplier := case
      when v_reimbursement.type = 'supplier_payment'
        then coalesce(v_reimbursement.supplier_name, v_reimbursement.account_info ->> 'holder_name', 'Proveedor')
      else coalesce(v_reimbursement.account_info ->> 'holder_name', 'Rendicion')
    end;

    v_description := case
      when v_reimbursement.type = 'supplier_payment' and v_reimbursement.folio is not null
        then format('Pago a Proveedor #%s: %s', v_reimbursement.folio, v_reimbursement.subject)
      when v_reimbursement.type = 'supplier_payment'
        then format('Pago a Proveedor: %s', v_reimbursement.subject)
      when v_reimbursement.folio is not null
        then format('Rendicion #%s: %s', v_reimbursement.folio, v_reimbursement.subject)
      else format('Rendicion: %s', v_reimbursement.subject)
    end;

    insert into public.expenses (
      folio,
      tenant_id,
      supplier,
      expense_date,
      amount,
      description
    )
    values (
      v_expense_folio,
      v_reimbursement.tenant_id,
      v_supplier,
      current_date,
      v_reimbursement.amount,
      v_description
    );
  end if;

  update public.reimbursements
  set status = 'approved',
      processed_by = target_processed_by,
      processed_at = now(),
      rejection_reason = null,
      payment_proof = case
        when jsonb_array_length(v_payment_proof) > 0 then v_payment_proof
        when payment_proof is null then null
        else payment_proof
      end,
      expense_folio = v_expense_folio
  where id = target_reimbursement_id;

  return query
  select target_reimbursement_id, v_expense_folio;
end;
$$;

create or replace function public.reject_reimbursement_transaction(
  target_reimbursement_id uuid,
  target_processed_by uuid,
  target_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reimbursement public.reimbursements%rowtype;
begin
  if target_reimbursement_id is null then
    raise exception 'target_reimbursement_id is required';
  end if;

  if target_processed_by is null then
    raise exception 'target_processed_by is required';
  end if;

  if trim(coalesce(target_rejection_reason, '')) = '' then
    raise exception 'target_rejection_reason is required';
  end if;

  select *
    into v_reimbursement
  from public.reimbursements
  where id = target_reimbursement_id
  for update;

  if not found then
    raise exception 'reimbursement % not found', target_reimbursement_id;
  end if;

  if coalesce(v_reimbursement.status, 'pending') <> 'pending' then
    raise exception 'reimbursement % is already processed', target_reimbursement_id;
  end if;

  update public.reimbursements
  set status = 'rejected',
      rejection_reason = trim(target_rejection_reason),
      processed_by = target_processed_by,
      processed_at = now()
  where id = target_reimbursement_id;

  return target_reimbursement_id;
end;
$$;

create or replace function public.reopen_reimbursement_transaction(
  target_reimbursement_id uuid,
  target_processed_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reimbursement public.reimbursements%rowtype;
begin
  if target_reimbursement_id is null then
    raise exception 'target_reimbursement_id is required';
  end if;

  if target_processed_by is null then
    raise exception 'target_processed_by is required';
  end if;

  select *
    into v_reimbursement
  from public.reimbursements
  where id = target_reimbursement_id
  for update;

  if not found then
    raise exception 'reimbursement % not found', target_reimbursement_id;
  end if;

  if coalesce(v_reimbursement.status, 'pending') = 'pending' then
    raise exception 'reimbursement % is already pending', target_reimbursement_id;
  end if;

  if v_reimbursement.expense_folio is not null then
    delete from public.expenses
    where tenant_id = v_reimbursement.tenant_id
      and folio = v_reimbursement.expense_folio;
  end if;

  update public.reimbursements
  set status = 'pending',
      processed_by = null,
      processed_at = null,
      rejection_reason = null,
      payment_proof = null,
      expense_folio = null
  where id = target_reimbursement_id;

  return target_reimbursement_id;
end;
$$;

create or replace function public.delete_reimbursement_transaction(
  target_reimbursement_id uuid,
  target_processed_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reimbursement public.reimbursements%rowtype;
begin
  if target_reimbursement_id is null then
    raise exception 'target_reimbursement_id is required';
  end if;

  if target_processed_by is null then
    raise exception 'target_processed_by is required';
  end if;

  select *
    into v_reimbursement
  from public.reimbursements
  where id = target_reimbursement_id
  for update;

  if not found then
    raise exception 'reimbursement % not found', target_reimbursement_id;
  end if;

  if v_reimbursement.expense_folio is not null then
    delete from public.expenses
    where tenant_id = v_reimbursement.tenant_id
      and folio = v_reimbursement.expense_folio;
  end if;

  delete from public.reimbursements
  where id = target_reimbursement_id;

  return target_reimbursement_id;
end;
$$;

grant execute on function public.approve_reimbursement_transaction(uuid, uuid, jsonb) to service_role;
grant execute on function public.reject_reimbursement_transaction(uuid, uuid, text) to service_role;
grant execute on function public.reopen_reimbursement_transaction(uuid, uuid) to service_role;
grant execute on function public.delete_reimbursement_transaction(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
