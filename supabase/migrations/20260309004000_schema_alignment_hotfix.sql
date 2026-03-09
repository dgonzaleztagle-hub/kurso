-- Hotfix de alineacion de schema con el frontend actual

-- Expenses
alter table public.expenses add column if not exists supplier text;
alter table public.expenses add column if not exists created_by uuid;
alter table public.expenses add column if not exists folio integer;

-- Activity donations
alter table public.activity_donations add column if not exists unit text not null default 'Unidad';
alter table public.activity_donations add column if not exists cantidad_original text;

-- Reimbursements / supplier payments
alter table public.reimbursements add column if not exists subject text;
alter table public.reimbursements add column if not exists account_info jsonb;
alter table public.reimbursements add column if not exists attachments jsonb;
alter table public.reimbursements add column if not exists user_id uuid;
alter table public.reimbursements add column if not exists supplier_name text;
alter table public.reimbursements add column if not exists payment_proof jsonb;
alter table public.reimbursements add column if not exists expense_folio integer;
alter table public.reimbursements add column if not exists processed_by uuid;
alter table public.reimbursements add column if not exists processed_at timestamptz;
alter table public.reimbursements add column if not exists rejection_reason text;
alter table public.reimbursements add column if not exists folio integer;

-- Forms
alter table public.forms add column if not exists is_public boolean not null default true;
alter table public.forms add column if not exists requires_login boolean not null default false;
alter table public.forms add column if not exists allow_multiple_responses boolean not null default false;
alter table public.forms add column if not exists closes_at timestamptz;

-- Form fields
alter table public.form_fields add column if not exists description text;
alter table public.form_fields add column if not exists conditional_logic jsonb;

-- Form responses (compatibilidad con modelo actual)
alter table public.form_responses add column if not exists user_id uuid;
alter table public.form_responses add column if not exists response_data jsonb not null default '{}'::jsonb;

-- Si existe la columna legacy "responses" y response_data está vacía, migrar datos
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'form_responses'
      and column_name = 'responses'
  ) then
    execute $sql$
      update public.form_responses
      set response_data = responses
      where response_data = '{}'::jsonb and responses is not null
    $sql$;
  end if;
end$$;

-- Derivar tenant_id desde forms cuando esté nulo
update public.form_responses fr
set tenant_id = f.tenant_id
from public.forms f
where fr.form_id = f.id and fr.tenant_id is null;

-- Índices útiles
create index if not exists idx_expenses_tenant_supplier on public.expenses(tenant_id, supplier);
create index if not exists idx_reimbursements_tenant_status on public.reimbursements(tenant_id, status);
create index if not exists idx_form_responses_form_user on public.form_responses(form_id, user_id);
create index if not exists idx_form_responses_form_student on public.form_responses(form_id, student_id);
