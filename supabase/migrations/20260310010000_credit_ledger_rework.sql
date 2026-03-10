alter table public.payments
  add column if not exists redirected_amount numeric(12,2) not null default 0,
  add column if not exists redirect_status text not null default 'available',
  add column if not exists redirect_locked boolean not null default false,
  add column if not exists last_redirected_at timestamptz,
  add column if not exists last_redirected_by uuid,
  add column if not exists redirect_notes text;

alter table public.credit_movements
  add column if not exists source_payment_id integer references public.payments(id) on delete set null,
  add column if not exists target_type text,
  add column if not exists target_month text,
  add column if not exists target_activity_id integer references public.activities(id) on delete set null,
  add column if not exists related_movement_id uuid references public.credit_movements(id) on delete set null,
  add column if not exists details jsonb not null default '[]'::jsonb,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid,
  add column if not exists reversal_reason text;

create table if not exists public.credit_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id integer not null references public.students(id) on delete cascade,
  source_payment_id integer references public.payments(id) on delete set null,
  source_credit_movement_id uuid not null references public.credit_movements(id) on delete cascade,
  applied_movement_id uuid not null references public.credit_movements(id) on delete cascade,
  target_type text not null check (target_type in ('monthly_fee', 'activity')),
  target_month text,
  target_activity_id integer references public.activities(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  reversed_amount numeric(12,2) not null default 0,
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  status text not null default 'applied' check (status in ('applied', 'partially_reversed', 'reversed')),
  constraint credit_applications_target_check check (
    (target_type = 'monthly_fee' and target_month is not null and target_activity_id is null)
    or
    (target_type = 'activity' and target_month is null and target_activity_id is not null)
  )
);

create index if not exists idx_credit_applications_tenant_student on public.credit_applications(tenant_id, student_id, created_at);
create index if not exists idx_credit_applications_source_movement on public.credit_applications(source_credit_movement_id);
create index if not exists idx_credit_applications_applied_movement on public.credit_applications(applied_movement_id);
create index if not exists idx_credit_movements_student_created on public.credit_movements(tenant_id, student_id, created_at);
create index if not exists idx_payments_redirect_status on public.payments(tenant_id, redirect_status, redirect_locked);

alter table public.credit_applications enable row level security;

drop policy if exists credit_applications_select on public.credit_applications;
create policy credit_applications_select
on public.credit_applications
for select to authenticated
using (
  public.auth_is_superadmin()
  or public.auth_owns_tenant(tenant_id)
  or exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = credit_applications.tenant_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists credit_applications_insert on public.credit_applications;
create policy credit_applications_insert
on public.credit_applications
for insert to authenticated
with check (
  public.auth_is_superadmin()
  or public.auth_owns_tenant(tenant_id)
  or exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = credit_applications.tenant_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists credit_applications_update on public.credit_applications;
create policy credit_applications_update
on public.credit_applications
for update to authenticated
using (
  public.auth_is_superadmin()
  or public.auth_owns_tenant(tenant_id)
  or exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = credit_applications.tenant_id
      and tm.user_id = auth.uid()
  )
)
with check (
  public.auth_is_superadmin()
  or public.auth_owns_tenant(tenant_id)
  or exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = credit_applications.tenant_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists credit_applications_delete on public.credit_applications;
create policy credit_applications_delete
on public.credit_applications
for delete to authenticated
using (public.auth_is_superadmin());

create or replace function public.can_manage_credit(target_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return
    public.auth_is_superadmin()
    or public.auth_owns_tenant(target_tenant_id)
    or exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = target_tenant_id
        and tm.user_id = auth.uid()
    );
end;
$$;

grant execute on function public.can_manage_credit(uuid) to authenticated;

create or replace function public.recompute_student_credit_balance(
  p_tenant_id uuid,
  p_student_id integer
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(12,2);
begin
  select coalesce(sum(cm.amount), 0)
  into v_amount
  from public.credit_movements cm
  where cm.tenant_id = p_tenant_id
    and cm.student_id = p_student_id;

  insert into public.student_credits (tenant_id, student_id, amount, updated_at)
  values (p_tenant_id, p_student_id, v_amount, now())
  on conflict (student_id) do update
    set amount = excluded.amount,
        updated_at = now();

  return v_amount;
end;
$$;

grant execute on function public.recompute_student_credit_balance(uuid, integer) to authenticated;

create or replace function public.redirect_payment_to_credit(
  p_payment_id integer,
  p_amount numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_movement_id uuid;
begin
  select *
  into v_payment
  from public.payments p
  where p.id = p_payment_id
  for update;

  if not found then
    raise exception 'Pago no encontrado';
  end if;

  if not public.can_manage_credit(v_payment.tenant_id) then
    raise exception 'No autorizado para gestionar créditos';
  end if;

  if v_payment.student_id is null then
    raise exception 'El pago no tiene estudiante asociado';
  end if;

  if coalesce(v_payment.redirected_amount, 0) > 0 or coalesce(v_payment.redirect_locked, false) then
    raise exception 'Este pago ya fue redirigido y está bloqueado';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto a redirigir debe ser mayor a cero';
  end if;

  if p_amount > coalesce(v_payment.amount, 0) then
    raise exception 'El monto a redirigir no puede exceder el monto del pago';
  end if;

  insert into public.credit_movements (
    tenant_id,
    student_id,
    amount,
    type,
    description,
    created_by,
    source_payment_id,
    details
  )
  values (
    v_payment.tenant_id,
    v_payment.student_id,
    p_amount,
    'credit_created_from_payment',
    coalesce(
      p_notes,
      format('Crédito generado desde pago folio %s (%s)', coalesce(v_payment.folio::text, v_payment.id::text), coalesce(v_payment.concept, 'Sin concepto'))
    ),
    auth.uid(),
    v_payment.id,
    jsonb_build_array(
      jsonb_build_object(
        'payment_id', v_payment.id,
        'folio', v_payment.folio,
        'concept', v_payment.concept,
        'original_amount', v_payment.amount,
        'redirected_amount', p_amount
      )
    )
  )
  returning id into v_movement_id;

  update public.payments
  set redirected_amount = p_amount,
      redirect_status = case when p_amount >= v_payment.amount then 'fully_redirected' else 'partially_redirected' end,
      redirect_locked = true,
      last_redirected_at = now(),
      last_redirected_by = auth.uid(),
      redirect_notes = p_notes
  where id = v_payment.id;

  perform public.recompute_student_credit_balance(v_payment.tenant_id, v_payment.student_id);

  return v_movement_id;
end;
$$;

grant execute on function public.redirect_payment_to_credit(integer, numeric, text) to authenticated;

create or replace function public.apply_credit_manually(
  p_student_id integer,
  p_target_type text,
  p_target_month text default null,
  p_target_activity_id integer default null,
  p_amount numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_available numeric(12,2);
  v_remaining numeric(12,2);
  v_applied_movement_id uuid;
  v_allocation_amount numeric(12,2);
  v_source record;
begin
  select s.tenant_id
  into v_tenant_id
  from public.students s
  where s.id = p_student_id;

  if v_tenant_id is null then
    raise exception 'Estudiante no encontrado';
  end if;

  if not public.can_manage_credit(v_tenant_id) then
    raise exception 'No autorizado para aplicar créditos';
  end if;

  if p_target_type not in ('monthly_fee', 'activity') then
    raise exception 'Tipo de destino inválido';
  end if;

  if p_target_type = 'monthly_fee' and coalesce(trim(p_target_month), '') = '' then
    raise exception 'Debe indicar el mes a cubrir';
  end if;

  if p_target_type = 'activity' then
    if p_target_activity_id is null then
      raise exception 'Debe indicar la actividad a cubrir';
    end if;

    if not exists (
      select 1
      from public.activities a
      where a.id = p_target_activity_id
        and a.tenant_id = v_tenant_id
    ) then
      raise exception 'La actividad indicada no existe en este tenant';
    end if;
  end if;

  select coalesce(sum(cm.amount), 0)
  into v_available
  from public.credit_movements cm
  where cm.tenant_id = v_tenant_id
    and cm.student_id = p_student_id;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto a aplicar debe ser mayor a cero';
  end if;

  if p_amount > v_available then
    raise exception 'El monto a aplicar excede el crédito disponible';
  end if;

  insert into public.credit_movements (
    tenant_id,
    student_id,
    amount,
    type,
    description,
    created_by,
    target_type,
    target_month,
    target_activity_id,
    details
  )
  values (
    v_tenant_id,
    p_student_id,
    -p_amount,
    case when p_target_type = 'monthly_fee' then 'credit_applied_to_monthly_fee' else 'credit_applied_to_activity' end,
    coalesce(
      p_notes,
      case
        when p_target_type = 'monthly_fee' then format('Aplicación manual de crédito a cuota %s', p_target_month)
        else format('Aplicación manual de crédito a actividad %s', p_target_activity_id::text)
      end
    ),
    auth.uid(),
    p_target_type,
    p_target_month,
    p_target_activity_id,
    jsonb_build_array(
      jsonb_build_object(
        'target_type', p_target_type,
        'target_month', p_target_month,
        'target_activity_id', p_target_activity_id,
        'amount', p_amount
      )
    )
  )
  returning id into v_applied_movement_id;

  v_remaining := p_amount;

  for v_source in
    with source_totals as (
      select
        cm.id,
        cm.source_payment_id,
        cm.created_at,
        cm.amount,
        coalesce(sum(ca.amount - ca.reversed_amount), 0) as allocated_amount,
        coalesce((
          select sum(abs(rm.amount))
          from public.credit_movements rm
          where rm.related_movement_id = cm.id
            and rm.type = 'credit_reversal'
            and rm.amount < 0
        ), 0) as reversed_amount
      from public.credit_movements cm
      left join public.credit_applications ca
        on ca.source_credit_movement_id = cm.id
      where cm.tenant_id = v_tenant_id
        and cm.student_id = p_student_id
        and cm.amount > 0
      group by cm.id, cm.source_payment_id, cm.created_at, cm.amount
    )
    select *
    from source_totals
    where amount - allocated_amount - reversed_amount > 0
    order by created_at asc, id asc
  loop
    exit when v_remaining <= 0;

    v_allocation_amount := least(v_remaining, v_source.amount - v_source.allocated_amount - v_source.reversed_amount);

    insert into public.credit_applications (
      tenant_id,
      student_id,
      source_payment_id,
      source_credit_movement_id,
      applied_movement_id,
      target_type,
      target_month,
      target_activity_id,
      amount,
      created_by
    )
    values (
      v_tenant_id,
      p_student_id,
      v_source.source_payment_id,
      v_source.id,
      v_applied_movement_id,
      p_target_type,
      p_target_month,
      p_target_activity_id,
      v_allocation_amount,
      auth.uid()
    );

    v_remaining := v_remaining - v_allocation_amount;
  end loop;

  if v_remaining > 0 then
    raise exception 'No fue posible distribuir el crédito disponible';
  end if;

  perform public.recompute_student_credit_balance(v_tenant_id, p_student_id);

  return v_applied_movement_id;
end;
$$;

grant execute on function public.apply_credit_manually(integer, text, text, integer, numeric, text) to authenticated;

create or replace function public.reverse_credit_movement(
  p_movement_id uuid,
  p_amount numeric,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement public.credit_movements%rowtype;
  v_remaining numeric(12,2);
  v_reverse_id uuid;
  v_application record;
  v_chunk numeric(12,2);
  v_new_redirected_amount numeric(12,2);
begin
  if not public.auth_is_superadmin() then
    raise exception 'Solo el superadmin puede reversar movimientos';
  end if;

  select *
  into v_movement
  from public.credit_movements cm
  where cm.id = p_movement_id
  for update;

  if not found then
    raise exception 'Movimiento no encontrado';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto a reversar debe ser mayor a cero';
  end if;

  if v_movement.amount > 0 then
    with allocation_totals as (
      select
        coalesce(sum(ca.amount - ca.reversed_amount), 0) as allocated_amount,
        coalesce((
          select sum(abs(rm.amount))
          from public.credit_movements rm
          where rm.related_movement_id = v_movement.id
            and rm.type = 'credit_reversal'
            and rm.amount < 0
        ), 0) as reversed_amount
      from public.credit_applications ca
      where ca.source_credit_movement_id = v_movement.id
    )
    select v_movement.amount - allocated_amount - reversed_amount
    into v_remaining
    from allocation_totals;

    if p_amount > coalesce(v_remaining, 0) then
      raise exception 'No es posible reversar más crédito del disponible en este movimiento';
    end if;

    insert into public.credit_movements (
      tenant_id,
      student_id,
      amount,
      type,
      description,
      created_by,
      source_payment_id,
      related_movement_id,
      reversal_reason,
      details
    )
    values (
      v_movement.tenant_id,
      v_movement.student_id,
      -p_amount,
      'credit_reversal',
      coalesce(p_reason, format('Reversa parcial de crédito %s', v_movement.id)),
      auth.uid(),
      v_movement.source_payment_id,
      v_movement.id,
      p_reason,
      jsonb_build_array(jsonb_build_object('reversed_movement_id', v_movement.id, 'amount', p_amount))
    )
    returning id into v_reverse_id;

    if v_movement.source_payment_id is not null then
      update public.payments
      set redirected_amount = greatest(0, coalesce(redirected_amount, 0) - p_amount),
          redirect_status = case
            when greatest(0, coalesce(redirected_amount, 0) - p_amount) = 0 then 'available'
            when greatest(0, coalesce(redirected_amount, 0) - p_amount) < amount then 'partially_redirected'
            else 'fully_redirected'
          end,
          redirect_locked = greatest(0, coalesce(redirected_amount, 0) - p_amount) > 0,
          last_redirected_at = now(),
          last_redirected_by = auth.uid(),
          redirect_notes = coalesce(p_reason, redirect_notes)
      where id = v_movement.source_payment_id
      returning redirected_amount into v_new_redirected_amount;
    end if;
  else
    select
      abs(v_movement.amount) - coalesce((
        select sum(rm.amount)
        from public.credit_movements rm
        where rm.related_movement_id = v_movement.id
          and rm.type = 'credit_reversal'
          and rm.amount > 0
      ), 0)
    into v_remaining;

    if p_amount > coalesce(v_remaining, 0) then
      raise exception 'No es posible reversar más crédito del ya aplicado';
    end if;

    insert into public.credit_movements (
      tenant_id,
      student_id,
      amount,
      type,
      description,
      created_by,
      source_payment_id,
      related_movement_id,
      target_type,
      target_month,
      target_activity_id,
      reversal_reason,
      details
    )
    values (
      v_movement.tenant_id,
      v_movement.student_id,
      p_amount,
      'credit_reversal',
      coalesce(p_reason, format('Reversa parcial de aplicación %s', v_movement.id)),
      auth.uid(),
      v_movement.source_payment_id,
      v_movement.id,
      v_movement.target_type,
      v_movement.target_month,
      v_movement.target_activity_id,
      p_reason,
      jsonb_build_array(jsonb_build_object('reversed_movement_id', v_movement.id, 'amount', p_amount))
    )
    returning id into v_reverse_id;

    v_remaining := p_amount;

    for v_application in
      select *
      from public.credit_applications ca
      where ca.applied_movement_id = v_movement.id
        and ca.amount > ca.reversed_amount
      order by ca.created_at desc, ca.id desc
    loop
      exit when v_remaining <= 0;

      v_chunk := least(v_remaining, v_application.amount - v_application.reversed_amount);

      update public.credit_applications
      set reversed_amount = reversed_amount + v_chunk,
          reversed_at = now(),
          reversed_by = auth.uid(),
          reversal_reason = p_reason,
          status = case
            when reversed_amount + v_chunk >= amount then 'reversed'
            when reversed_amount + v_chunk > 0 then 'partially_reversed'
            else 'applied'
          end
      where id = v_application.id;

      v_remaining := v_remaining - v_chunk;
    end loop;
  end if;

  perform public.recompute_student_credit_balance(v_movement.tenant_id, v_movement.student_id);

  return v_reverse_id;
end;
$$;

grant execute on function public.reverse_credit_movement(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';
