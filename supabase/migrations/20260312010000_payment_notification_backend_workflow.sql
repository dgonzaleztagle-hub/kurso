create or replace function public.approve_payment_notification_transaction(
  target_notification_id uuid,
  payment_entries jsonb,
  target_processed_by uuid
)
returns table (
  notification_id uuid,
  inserted_payment_ids bigint[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.payment_notifications%rowtype;
  v_payment_count integer;
  v_start_folio integer;
  v_inserted_ids bigint[] := '{}';
begin
  if target_notification_id is null then
    raise exception 'target_notification_id is required';
  end if;

  if target_processed_by is null then
    raise exception 'target_processed_by is required';
  end if;

  if payment_entries is null or jsonb_typeof(payment_entries) <> 'array' or jsonb_array_length(payment_entries) = 0 then
    raise exception 'payment_entries must be a non-empty array';
  end if;

  select *
    into v_notification
  from public.payment_notifications
  where id = target_notification_id
  for update;

  if not found then
    raise exception 'payment notification % not found', target_notification_id;
  end if;

  if coalesce(v_notification.status, 'pending') <> 'pending' then
    raise exception 'payment notification % is already processed', target_notification_id;
  end if;

  v_payment_count := jsonb_array_length(payment_entries);
  v_start_folio := public.reserve_payment_folios_for_tenant(v_notification.tenant_id, v_payment_count);

  with entries as (
    select
      value,
      ordinality
    from jsonb_array_elements(payment_entries) with ordinality
  ),
  inserted as (
    insert into public.payments (
      folio,
      tenant_id,
      payment_date,
      student_id,
      student_name,
      activity_id,
      concept,
      amount,
      month_period,
      created_by
    )
    select
      v_start_folio + entries.ordinality - 1,
      v_notification.tenant_id,
      coalesce(nullif(entries.value->>'payment_date', '')::date, v_notification.payment_date),
      coalesce(nullif(entries.value->>'student_id', '')::bigint, v_notification.student_id::bigint),
      nullif(entries.value->>'student_name', ''),
      nullif(entries.value->>'activity_id', '')::bigint,
      coalesce(nullif(entries.value->>'concept', ''), 'Pago'),
      coalesce(nullif(entries.value->>'amount', '')::numeric, 0),
      nullif(entries.value->>'month_period', ''),
      target_processed_by
    from entries
    returning id
  )
  select coalesce(array_agg(id order by id), '{}')
    into v_inserted_ids
  from inserted;

  update public.payment_notifications
  set status = 'approved',
      processed_by = target_processed_by,
      processed_at = now(),
      rejection_reason = null
  where id = target_notification_id;

  return query
  select target_notification_id, v_inserted_ids;
end;
$$;

create or replace function public.reject_payment_notification_transaction(
  target_notification_id uuid,
  target_processed_by uuid,
  target_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.payment_notifications%rowtype;
begin
  if target_notification_id is null then
    raise exception 'target_notification_id is required';
  end if;

  if target_processed_by is null then
    raise exception 'target_processed_by is required';
  end if;

  if trim(coalesce(target_rejection_reason, '')) = '' then
    raise exception 'target_rejection_reason is required';
  end if;

  select *
    into v_notification
  from public.payment_notifications
  where id = target_notification_id
  for update;

  if not found then
    raise exception 'payment notification % not found', target_notification_id;
  end if;

  if coalesce(v_notification.status, 'pending') <> 'pending' then
    raise exception 'payment notification % is already processed', target_notification_id;
  end if;

  update public.payment_notifications
  set status = 'rejected',
      rejection_reason = trim(target_rejection_reason),
      processed_by = target_processed_by,
      processed_at = now()
  where id = target_notification_id;

  return target_notification_id;
end;
$$;

grant execute on function public.approve_payment_notification_transaction(uuid, jsonb, uuid) to service_role;
grant execute on function public.reject_payment_notification_transaction(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
