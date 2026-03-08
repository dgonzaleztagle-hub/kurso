-- KURSO CLEAN BASELINE
-- Generated: 2026-03-08T19:46:44
-- Single source of truth for fresh databases



-- ============================================================================
-- SOURCE: 20250101_01_init_saas.sql
-- ============================================================================

/*
  KURSO SAAS - INIT MIGRATION
  ---------------------------
  Arquitectura: Multi-tenant, Global Users, WhatsApp First.
*/

-- 1. ENUMS y TIPOS (Base)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('owner', 'admin', 'member', 'student');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
        CREATE TYPE plan_type AS ENUM ('basic', 'institutional');
    END IF;
END $$;

-- 2. TABLAS GLOBALES (SISTEMA)

-- A. Perfiles de Usuario (Extensión de auth.users)
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    whatsapp_number TEXT UNIQUE NOT NULL, -- Clave para contacto
    avatar_url TEXT,
    is_superadmin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. Organizaciones (Colegios - Modelo 2)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    director_contact TEXT, -- Puede ser referencia a app_users o texto plano inicial
    plan_type plan_type DEFAULT 'institutional',
    valid_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLAS TENANT (CURSOS)

-- A. Tenants (Cursos Individuales)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id), -- Opcional (si pertenece a colegio)
    name TEXT NOT NULL, -- Ej: "1° Básico A 2025"
    slug TEXT UNIQUE,
    owner_id UUID REFERENCES public.app_users(id), -- El "Master" original
    
    -- Ciclo de Vida
    subscription_status subscription_status DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'), -- trial base de 7 días
    valid_until DATE, -- Fecha límite de pago (para suscripciones activas)
    
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. Membresía (Quién pertenece a qué curso)
CREATE TABLE IF NOT EXISTS public.tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    role app_role DEFAULT 'member',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id) -- Un usuario no puede duplicarse en el mismo curso
);

-- 4. ADAPTACIÓN DE TABLAS DE NEGOCIO (Ejemplo con Students)
-- (Repetir patrón para payments, expenses, etc)

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL, -- VITAL: Link al Tenant
    
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    rut TEXT,
    birth_date DATE,
    
    -- Status
    enrollment_date DATE DEFAULT CURRENT_DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación Padre-Hijo (Global User -> Student)
CREATE TABLE IF NOT EXISTS public.student_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL, -- Desnormalizado para eficiencia RLS
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    relationship TEXT, -- "Madre", "Padre"
    is_prymary BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SEGURIDAD RLS (ROW LEVEL SECURITY) - EL CEREBRO 🧠

-- Habilitar RLS en todas las tablas
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 5.0 Políticas para App Users (Perfil Propio)
DROP POLICY IF EXISTS "Users can view own profile" ON public.app_users;
CREATE POLICY "Users can view own profile" 
ON public.app_users 
FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.app_users;
CREATE POLICY "Users can update own profile" 
ON public.app_users 
FOR UPDATE 
USING (auth.uid() = id);

-- 5.1 Políticas para Tenants
-- Ver tenants donde soy miembro
DROP POLICY IF EXISTS "Ver mis tenants" ON public.tenants;
CREATE POLICY "Ver mis tenants" ON public.tenants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members 
        WHERE tenant_id = public.tenants.id 
        AND user_id = auth.uid()
    )
    OR owner_id = auth.uid() -- O soy el dueño
);

-- 5.2 Política Maestra para Datos (Students, Payments, etc)
-- "Solo ver filas del tenant donde tengo acceso"
DROP POLICY IF EXISTS "Aislamiento de Alumnos" ON public.students;
CREATE POLICY "Aislamiento de Alumnos" ON public.students
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_members 
        WHERE user_id = auth.uid()
        AND status = 'active'
    )
);

-- 6. TRIGGERS Y FUNCIONES

-- Trigger: Al crear usuario en Auth -> Crear en App_Users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.app_users (id, email, whatsapp_number, full_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'whatsapp', ''), -- Importante capturar esto en signup
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING; -- Idempotent safety
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ============================================================================
-- SOURCE: 20250101_02_add_business_tables.sql
-- ============================================================================

/*
  KURSO SAAS - BUSINESS TABLES MIGRATION
  --------------------------------------
  Restauración de tablas de negocio adaptadas a Multi-Tenant.
  Tablas: payments, expenses, payment_notifications, reimbursements, activities.
*/

-- 1. PAGOS (Payments)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE,
    concept TEXT,
    payment_method TEXT, -- 'transfer', 'cash', 'webpay'
    status TEXT DEFAULT 'verified',
    activity_id UUID, -- Opcional, si es pago de actividad
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver pagos de mi tenant" ON public.payments;
CREATE POLICY "Ver pagos de mi tenant" ON public.payments
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ) OR tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
    )
);

-- 2. GASTOS (Expenses)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    category TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver gastos de mi tenant" ON public.expenses;
CREATE POLICY "Ver gastos de mi tenant" ON public.expenses
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ) OR tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
    )
);

-- 3. ACTIVIDADES (Activities)
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL, -- Costo por alumno
    activity_date DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver actividades de mi tenant" ON public.activities;
CREATE POLICY "Ver actividades de mi tenant" ON public.activities
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ) OR tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
    )
);

-- 4. EXCLUSIONES DE ACTIVIDAD (Activity Exclusions)
CREATE TABLE IF NOT EXISTS public.activity_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver exclusiones de mi tenant" ON public.activity_exclusions;
CREATE POLICY "Ver exclusiones de mi tenant" ON public.activity_exclusions
FOR ALL USING (
    tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        UNION
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
);

-- 5. NOTIFICACIONES DE PAGO (Payment Notifications)
CREATE TABLE IF NOT EXISTS public.payment_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id),
    amount NUMERIC,
    payment_date DATE,
    voucher_url TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    submitted_by UUID REFERENCES public.app_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver notificaciones de mi tenant" ON public.payment_notifications;
CREATE POLICY "Ver notificaciones de mi tenant" ON public.payment_notifications
FOR ALL USING (
    tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        UNION
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
);

-- 6. RENDICIONES (Reimbursements & Supplier Payments)
CREATE TABLE IF NOT EXISTS public.reimbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'reimbursement', -- reimbursement, supplier_payment
    status TEXT DEFAULT 'pending',
    requester_id UUID REFERENCES public.app_users(id),
    voucher_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver rendiciones de mi tenant" ON public.reimbursements;
CREATE POLICY "Ver rendiciones de mi tenant" ON public.reimbursements
FOR ALL USING (
    tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        UNION
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
);

-- CREDIT MANAGEMENTS (Deuda y Saldos)
CREATE TABLE IF NOT EXISTS public.credit_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL, -- 'payment_redirect', 'refund', 'credit'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credit_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver creditos de mi tenant" ON public.credit_movements;
CREATE POLICY "Ver creditos de mi tenant" ON public.credit_movements FOR ALL USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid() UNION SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
);


-- ============================================================================
-- SOURCE: 20250101_03_relax_user_constraints.sql
-- ============================================================================

-- Relax whatsapp_number constraint to allow initial creation by trigger with empty/null
-- This enables the 2-step flow: Signup (Auth) -> Onboarding (Profile Completion)

ALTER TABLE public.app_users ALTER COLUMN whatsapp_number DROP NOT NULL;

-- Remove the unique constraint if it exists on the empty string or generally, 
-- but we probably want to keep it unique for ACTUAL numbers.
-- Strategy: Use a partial unique index instead if needed, but for now just dropping NOT NULL is key.
-- If existing rows have '', they are fine. If new rows come as NULL, they are fine.
-- The trigger currently inserts `COALESCE(meta->>'whatsapp', '')`. We should probably change trigger too,
-- but dropping NOT NULL protects against 'failed to be not null' error if trigger logic changes.

-- OPTIONAL: If we want to allow multiple users with NULL/Empty whatsapp (ghost users pending onboarding)
-- we might need to drop the UNIQUE constraint or make it Partial (WHERE whatsapp_number IS NOT NULL AND whatsapp_number <> '').
-- Checking exisiting constraints to be safe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_whatsapp_number_key') THEN
    ALTER TABLE public.app_users DROP CONSTRAINT app_users_whatsapp_number_key;
  END IF;
END $$;

-- Re-create unique index only for valid numbers
CREATE UNIQUE INDEX IF NOT EXISTS app_users_whatsapp_number_unique_idx 
ON public.app_users (whatsapp_number) 
WHERE whatsapp_number IS NOT NULL AND whatsapp_number <> '';


-- ============================================================================
-- SOURCE: 20250101_04_fix_users_cloud.sql
-- ============================================================================

-- 1. Create or ensure demo@demo.cl exists in auth.users
-- This block uses a DO statement to perform checks and inserts
DO $$
DECLARE
    demo_email TEXT := 'demo@demo.cl';
    demo_uid UUID := '00000000-0000-0000-0000-000000000001'; -- Fixed ID for demo
BEGIN
    -- Check if auth user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = demo_email) THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_user_meta_data, created_at, updated_at, 
            confirmation_token, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            demo_uid,
            'authenticated',
            'authenticated',
            demo_email,
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"full_name": "Usuario Demo", "whatsapp": "+56900000000"}'::jsonb,
            NOW(),
            NOW(),
            '', ''
        );
    ELSE
         SELECT id INTO demo_uid FROM auth.users WHERE email = demo_email;
    END IF;

    -- Upsert app_users for Demo
    INSERT INTO public.app_users (id, email, full_name, whatsapp_number, is_superadmin)
    VALUES (demo_uid, demo_email, 'Usuario Demo', '+56900000000', false)
    ON CONFLICT (id) DO UPDATE
    SET full_name = 'Usuario Demo', 
        whatsapp_number = '+56900000000';
END $$;

-- 2. Force Update Daniel's Profile (SuperAdmin)
UPDATE public.app_users
SET 
    full_name = 'Daniel Gonzalez',
    whatsapp_number = '+56972739105',
    is_superadmin = true
WHERE email = 'dgonzalez.tagle@gmail.com';

-- 3. Fix RLS Recursion on Cloud DB (Apply Security Definer)
CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_users 
    WHERE id = auth.uid() 
    AND is_superadmin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.app_users;

CREATE POLICY "SuperAdmins can view all profiles"
ON public.app_users
FOR SELECT
USING (
  public.check_is_superadmin() = true
);


-- ============================================================================
-- SOURCE: 20250101_05_add_students_rut.sql
-- ============================================================================

-- Add RUT column to students table
-- First add it as nullable to avoid issues with existing data
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS rut text;

-- Create a unique index for RUT (insuring uniqueness but allowing nulls for legacy data effectively if needed, though UNIQUE constraint standard allows multiple NULLs in Postgres)
-- Using a partial index to ensure clean unique values only for non-null ruts
CREATE UNIQUE INDEX IF NOT EXISTS students_rut_unique_idx ON public.students (rut) WHERE rut IS NOT NULL;

-- Comment on column
COMMENT ON COLUMN public.students.rut IS 'RUT of the student, formatted as 12345678-9. Used for account generation.';


-- ============================================================================
-- SOURCE: 20250102_create_posts_table.sql
-- ============================================================================

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


-- ============================================================================
-- SOURCE: 20260305_fix_has_role_owner_alias.sql
-- ============================================================================

/*
  Fix has_role for owner compatibility
  ------------------------------------
  Causa:
  - Varias políticas legacy usan has_role(auth.uid(), 'master'|'admin').
  - Usuarios nuevos quedan como owner por tenant y no siempre como master global.
  - Resultado: 400/denegación al insertar en módulos como expenses/payments/notificaciones.

  Solución:
  - Owner activo (tenant_members) se interpreta como master/admin para compatibilidad.
  - Owner en user_roles también se interpreta como master/admin.
*/

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND (
          ur.role = _role
          OR (ur.role = 'owner'::public.app_role AND _role IN ('master'::public.app_role, 'admin'::public.app_role))
          OR (ur.role = 'master'::public.app_role AND _role = 'admin'::public.app_role)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.user_id = _user_id
        AND COALESCE(tm.status, 'active') = 'active'
        AND (
          tm.role = _role
          OR (tm.role = 'owner'::public.app_role AND _role IN ('master'::public.app_role, 'admin'::public.app_role))
          OR (tm.role = 'master'::public.app_role AND _role = 'admin'::public.app_role)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.app_users au
      WHERE au.id = _user_id
        AND au.is_superadmin = true
        AND _role IN ('owner'::public.app_role, 'master'::public.app_role, 'admin'::public.app_role)
    );
$$;


-- ============================================================================
-- SOURCE: 20260305_owner_admin_master_unified_access.sql
-- ============================================================================

/*
  Owner/Admin/Master Unified Access
  --------------------------------
  Objetivo:
  - Evitar bloqueos funcionales cuando el usuario principal queda como `owner`.
  - Alinear backend con la regla de negocio: owner/admin/master gestionan el tenant.
  - Aplicar sobre tablas críticas de operación diaria.
*/

DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  table_exists BOOLEAN;
  has_tenant_id BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'expenses',
    'payment_notifications',
    'reimbursements',
    'dashboard_notifications'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO table_exists;

    IF NOT table_exists THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'tenant_id'
    ) INTO has_tenant_id;

    IF NOT has_tenant_id THEN
      CONTINUE;
    END IF;

    policy_name := format('Unified %s tenant access', tbl);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, tbl);

    EXECUTE format($sql$
      CREATE POLICY %I
      ON public.%I
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = %I.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role IN ('owner', 'admin', 'master')
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = %I.tenant_id
            AND t.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = %I.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role IN ('owner', 'admin', 'master')
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = %I.tenant_id
            AND t.owner_id = auth.uid()
        )
      );
    $sql$, policy_name, tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;


-- ============================================================================
-- SOURCE: 20260306_fix_core_rls_for_owner_admin.sql
-- ============================================================================

/*
  Fix Core RLS for Owner/Admin/Master
  -----------------------------------
  Objetivo:
  - Evitar bloqueos RLS en módulos críticos reportados:
    payments, expenses, dashboard_notifications, activities, forms, form_fields.
  - No depender de funciones legacy como has_role() para autorizar operaciones internas.
*/

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'payments',
    'expenses',
    'dashboard_notifications',
    'activities',
    'forms',
    'form_fields'
  ]
  LOOP
    -- Skip if table does not exist.
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    -- Drop all previous policies on this table to avoid contradictory legacy checks.
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
    END LOOP;

    -- Unified access policy for internal app operators.
    EXECUTE format($sql$
      CREATE POLICY %I
      ON public.%I
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.app_users au
          WHERE au.id = auth.uid()
            AND au.is_superadmin = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role::text IN ('owner', 'master', 'admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.user_id = auth.uid()
            AND COALESCE(tm.status, 'active') = 'active'
            AND tm.role::text IN ('owner', 'master', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.app_users au
          WHERE au.id = auth.uid()
            AND au.is_superadmin = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role::text IN ('owner', 'master', 'admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.user_id = auth.uid()
            AND COALESCE(tm.status, 'active') = 'active'
            AND tm.role::text IN ('owner', 'master', 'admin')
        )
      );
    $sql$, format('Unified operator access %s', tbl), tbl);
  END LOOP;
END $$;



-- ============================================================================
-- SOURCE: 20260306_owner_controls_staff_membership.sql
-- ============================================================================

/*
  Owner controls staff membership
  -------------------------------
  Solo owner (o superadmin) puede administrar membresías del tenant.
*/

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_members_select ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_insert ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_update ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_delete ON public.tenant_members;

CREATE POLICY tenant_members_select
ON public.tenant_members
FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
);

CREATE POLICY tenant_members_insert
ON public.tenant_members
FOR INSERT
TO public
WITH CHECK (
  auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
);

CREATE POLICY tenant_members_update
ON public.tenant_members
FOR UPDATE
TO public
USING (
  auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
)
WITH CHECK (
  auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
);

CREATE POLICY tenant_members_delete
ON public.tenant_members
FOR DELETE
TO public
USING (
  auth_is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND coalesce(tm.status, 'active') = 'active'
      AND tm.role = 'owner'
  )
);


-- ============================================================================
-- SOURCE: 20260306_tenant_scope_and_audit_hardening.sql
-- ============================================================================

/*
  Tenant scope + audit hardening
  ------------------------------
  Objetivo:
  - Evitar cruces entre tenants en tablas operativas.
  - Mantener acceso de operación para owner/admin/master por tenant.
  - Mantener superadmin global.
  - Activar trazabilidad consistente en audit_logs.
*/

-- =============================
-- 1) RLS tenant-scoped (core)
-- =============================
DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'activities',
    'activity_donations',
    'dashboard_notifications',
    'expenses',
    'forms',
    'payment_notifications',
    'payments',
    'reimbursements',
    'scheduled_activities'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
    END LOOP;

    EXECUTE format($sql$
      CREATE POLICY %I
      ON public.%I
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.app_users au
          WHERE au.id = auth.uid()
            AND au.is_superadmin = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = %I.tenant_id
            AND t.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = %I.tenant_id
            AND tm.user_id = auth.uid()
            AND coalesce(tm.status, 'active') = 'active'
            AND tm.role::text IN ('owner', 'master', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.app_users au
          WHERE au.id = auth.uid()
            AND au.is_superadmin = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = %I.tenant_id
            AND t.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = %I.tenant_id
            AND tm.user_id = auth.uid()
            AND coalesce(tm.status, 'active') = 'active'
            AND tm.role::text IN ('owner', 'master', 'admin')
        )
      );
    $sql$, format('tenant_scoped_operator_access_%s', tbl), tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- form_fields no tiene tenant_id, se evalúa por forms.form_id
DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'form_fields'
  ) THEN
    ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'form_fields'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.form_fields;', pol.policyname);
    END LOOP;

    CREATE POLICY tenant_scoped_operator_access_form_fields
    ON public.form_fields
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.app_users au
        WHERE au.id = auth.uid()
          AND au.is_superadmin = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.forms f
        JOIN public.tenants t ON t.id = f.tenant_id
        WHERE f.id = form_fields.form_id
          AND t.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.forms f
        JOIN public.tenant_members tm ON tm.tenant_id = f.tenant_id
        WHERE f.id = form_fields.form_id
          AND tm.user_id = auth.uid()
          AND coalesce(tm.status, 'active') = 'active'
          AND tm.role::text IN ('owner', 'master', 'admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.app_users au
        WHERE au.id = auth.uid()
          AND au.is_superadmin = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.forms f
        JOIN public.tenants t ON t.id = f.tenant_id
        WHERE f.id = form_fields.form_id
          AND t.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.forms f
        JOIN public.tenant_members tm ON tm.tenant_id = f.tenant_id
        WHERE f.id = form_fields.form_id
          AND tm.user_id = auth.uid()
          AND coalesce(tm.status, 'active') = 'active'
          AND tm.role::text IN ('owner', 'master', 'admin')
      )
    );
  END IF;
END $$;

-- ====================================
-- 2) Auditoría automática consistente
-- ====================================
CREATE OR REPLACE FUNCTION public.log_table_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_record_id text;
  v_payload jsonb;
  v_row jsonb;
BEGIN
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN NULL;
  END IF;

  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_payload := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := to_jsonb(NEW);
    v_payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_row := to_jsonb(NEW);
    v_payload := jsonb_build_object('new', to_jsonb(NEW));
  END IF;

  IF v_row ? 'tenant_id' THEN
    BEGIN
      v_tenant_id := NULLIF(v_row->>'tenant_id', '')::uuid;
    EXCEPTION WHEN others THEN
      v_tenant_id := NULL;
    END;
  END IF;

  v_record_id := COALESCE(v_row->>'id', NULL);

  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    action,
    table_name,
    record_id,
    payload
  ) VALUES (
    v_tenant_id,
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_payload
  );

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  tbl text;
  trg_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'activities',
    'dashboard_notifications',
    'expenses',
    'forms',
    'meeting_minutes',
    'payment_notifications',
    'payments',
    'posts',
    'reimbursements',
    'scheduled_activities',
    'student_credits',
    'students',
    'tenant_members',
    'user_roles',
    'credit_movements'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    trg_name := format('trg_audit_%s', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', trg_name, tbl);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_table_audit_event();',
      trg_name,
      tbl
    );
  END LOOP;
END $$;


-- ============================================================================
-- SOURCE: 20260307_fix_generate_missing_accounts.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_db_user(
    p_email TEXT,
    p_password TEXT,
    p_metadata JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_enc_pass TEXT;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    IF v_user_id IS NULL THEN
        v_user_id := extensions.gen_random_uuid();
        v_enc_pass := extensions.crypt(p_password, extensions.gen_salt('bf'));

        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            p_email,
            v_enc_pass,
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            p_metadata,
            NOW(),
            NOW()
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM auth.identities
        WHERE user_id = v_user_id
          AND provider = 'email'
    ) THEN
        INSERT INTO auth.identities (
            id,
            provider_id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            extensions.gen_random_uuid(),
            v_user_id::text,
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', p_email),
            'email',
            NOW(),
            NOW(),
            NOW()
        );
    END IF;

    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_student RECORD;
    v_rut_clean TEXT;
    v_rut_body TEXT;
    v_email TEXT;
    v_pass TEXT;
    v_user_id UUID;
    v_created INT := 0;
    v_linked INT := 0;
BEGIN
    FOR r_student IN
        SELECT s.*
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id
          AND s.rut IS NOT NULL
          AND btrim(s.rut) <> ''
    LOOP
        v_rut_clean := lower(regexp_replace(r_student.rut, '[^0-9kK]', '', 'g'));
        IF length(v_rut_clean) < 2 THEN
            CONTINUE;
        END IF;

        v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
        v_email := v_rut_body || '@kurso.cl';
        v_pass := CASE
            WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
            WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
            ELSE '123456'
        END;

        SELECT id INTO v_user_id
        FROM auth.users
        WHERE email = v_email;

        IF v_user_id IS NULL THEN
            v_user_id := public.create_db_user(
                v_email,
                v_pass,
                jsonb_build_object(
                    'full_name', trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, '')),
                    'rut', r_student.rut,
                    'role', 'alumnos'
                )
            );
            v_created := v_created + 1;
        END IF;

        INSERT INTO public.app_users (id, email, full_name)
        VALUES (
            v_user_id,
            v_email,
            trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = EXCLUDED.full_name;

        INSERT INTO public.user_roles (user_id, role, first_login, user_name)
        VALUES (
            v_user_id,
            'alumnos',
            TRUE,
            trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
        )
        ON CONFLICT (user_id) DO UPDATE
        SET role = 'alumnos',
            user_name = EXCLUDED.user_name;

        INSERT INTO public.user_students (user_id, student_id, display_name)
        VALUES (
            v_user_id,
            r_student.id,
            trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
        )
        ON CONFLICT (user_id, student_id) DO UPDATE
        SET display_name = EXCLUDED.display_name;

        IF FOUND THEN
            v_linked := v_linked + 1;
        END IF;

        INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
        VALUES (p_tenant_id, v_user_id, 'alumnos', 'active')
        ON CONFLICT (tenant_id, user_id) DO UPDATE
        SET role = 'alumnos',
            status = 'active';
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'created', v_created,
        'linked', v_linked
    );
END;
$$;


-- ============================================================================
-- SOURCE: 20260307_fix_tenant_members_recursion.sql
-- ============================================================================

/*
  Fix tenant_members RLS recursion
  --------------------------------
  Problema observado en produccion:
  - SELECT sobre public.tenant_members responde 500
  - El onboarding entra en loop porque TenantContext no logra leer membresias

  Causa probable:
  - La policy tenant_members_select consulta public.tenant_members desde la propia
    policy, lo que puede disparar recursion RLS segun el plan de ejecucion activo.

  Solucion:
  - Reemplazar policies de tenant_members por versiones no recursivas
  - Usar funciones SECURITY DEFINER para chequear superadmin y owner tecnico
*/

CREATE OR REPLACE FUNCTION public.auth_is_superadmin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.id = auth.uid()
      AND au.is_superadmin = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_owns_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = target_tenant_id
      AND t.owner_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_owns_tenant(uuid) TO authenticated;

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_members_select ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_insert ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_update ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_delete ON public.tenant_members;

CREATE POLICY tenant_members_select
ON public.tenant_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.auth_is_superadmin()
  OR public.auth_owns_tenant(tenant_id)
);

CREATE POLICY tenant_members_insert
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_is_superadmin()
  OR public.auth_owns_tenant(tenant_id)
);

CREATE POLICY tenant_members_update
ON public.tenant_members
FOR UPDATE
TO authenticated
USING (
  public.auth_is_superadmin()
  OR public.auth_owns_tenant(tenant_id)
)
WITH CHECK (
  public.auth_is_superadmin()
  OR public.auth_owns_tenant(tenant_id)
);

CREATE POLICY tenant_members_delete
ON public.tenant_members
FOR DELETE
TO authenticated
USING (
  public.auth_is_superadmin()
  OR public.auth_owns_tenant(tenant_id)
);


-- ============================================================================
-- SOURCE: 20260308_fix_create_db_user_provider_id.sql
-- ============================================================================

-- ============================================================
-- Fix create_db_user: ensure auth.identities.provider_id is set
-- Date: 2026-03-08
-- Root cause: account creation fails with NOT NULL violation on provider_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_db_user(
    p_email TEXT,
    p_password TEXT,
    p_metadata JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_enc_pass TEXT;
    v_email TEXT;
BEGIN
    v_email := lower(trim(p_email));

    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        v_user_id := extensions.gen_random_uuid();
        v_enc_pass := extensions.crypt(p_password, extensions.gen_salt('bf'));

        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_email,
            v_enc_pass,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            coalesce(p_metadata, '{}'::jsonb),
            NOW(),
            NOW()
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM auth.identities
        WHERE user_id = v_user_id
          AND provider = 'email'
    ) THEN
        INSERT INTO auth.identities (
            id,
            provider_id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            extensions.gen_random_uuid(),
            v_email,
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_email),
            'email',
            NOW(),
            NOW(),
            NOW()
        );
    ELSE
        UPDATE auth.identities
        SET provider_id = v_email,
            identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('sub', v_user_id::text, 'email', v_email),
            updated_at = NOW()
        WHERE user_id = v_user_id
          AND provider = 'email'
          AND (provider_id IS NULL OR provider_id = '' OR identity_data IS NULL);
    END IF;

    RETURN v_user_id;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creando usuario de auth: %', SQLERRM;
END;
$$;


-- ============================================================================
-- SOURCE: 20260308_fix_student_auth_domain_and_roles.sql
-- ============================================================================

-- ============================================================
-- Student auth hardening (domain + tenant role alignment)
-- Date: 2026-03-08
-- ============================================================

-- 1) Keep existing student users reachable after domain transition
UPDATE auth.users au
SET email = regexp_replace(au.email, '@kurso\.cl$', '@estudiantes.kurso')
FROM public.user_roles ur
WHERE ur.user_id = au.id
  AND ur.role = 'alumnos'
  AND au.email ~ '@kurso\.cl$';

UPDATE public.app_users ap
SET email = regexp_replace(ap.email, '@kurso\.cl$', '@estudiantes.kurso')
FROM public.user_roles ur
WHERE ur.user_id = ap.id
  AND ur.role = 'alumnos'
  AND ap.email ~ '@kurso\.cl$';

-- 2) Ensure tenant role for students is compatible with route guards
UPDATE public.tenant_members tm
SET role = 'alumnos'
FROM public.user_roles ur
WHERE ur.user_id = tm.user_id
  AND ur.role = 'alumnos'
  AND tm.role IN ('member', 'student');

-- 3) New student creation should use @estudiantes.kurso + alumnos role
CREATE OR REPLACE FUNCTION public.create_auth_user_from_rut(
    p_rut TEXT,
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS UUID AS $$
DECLARE
    v_rut_clean TEXT;
    v_rut_body TEXT;
    v_email TEXT;
    v_pass TEXT;
    v_user_id UUID;
BEGIN
    v_rut_clean := lower(regexp_replace(p_rut, '[^0-9kK]', '', 'g'));

    IF length(v_rut_clean) < 2 THEN
        RAISE EXCEPTION 'RUT inválido: %', p_rut;
    END IF;

    v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
    v_email := v_rut_body || '@estudiantes.kurso';

    v_pass := CASE
        WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
        WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
        ELSE '123456'
    END;

    v_user_id := public.create_db_user(
        v_email,
        v_pass,
        jsonb_build_object(
            'full_name', trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')),
            'rut', p_rut,
            'role', 'alumnos'
        )
    );

    RETURN v_user_id;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creando usuario: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.tr_student_create_auth_account()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_full_name TEXT;
    v_email TEXT;
BEGIN
    IF NEW.rut IS NOT NULL AND btrim(NEW.rut) <> '' THEN
        BEGIN
            v_user_id := public.create_auth_user_from_rut(
                NEW.rut,
                NEW.first_name,
                NEW.last_name
            );

            IF v_user_id IS NOT NULL THEN
                v_full_name := trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
                v_email := lower(regexp_replace(NEW.rut, '[^0-9kK]', '', 'g'));
                v_email := substring(v_email from 1 for length(v_email) - 1) || '@estudiantes.kurso';

                INSERT INTO public.app_users (id, email, full_name)
                VALUES (v_user_id, v_email, v_full_name)
                ON CONFLICT (id) DO UPDATE
                SET email = EXCLUDED.email,
                    full_name = EXCLUDED.full_name;

                INSERT INTO public.user_roles (user_id, role, first_login, user_name)
                VALUES (v_user_id, 'alumnos', TRUE, v_full_name)
                ON CONFLICT (user_id) DO UPDATE
                SET role = 'alumnos',
                    user_name = EXCLUDED.user_name;

                INSERT INTO public.user_students (user_id, student_id, display_name)
                VALUES (v_user_id, NEW.id, v_full_name)
                ON CONFLICT (user_id, student_id) DO UPDATE
                SET display_name = EXCLUDED.display_name;

                IF NEW.tenant_id IS NOT NULL THEN
                    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
                    VALUES (NEW.tenant_id, v_user_id, 'alumnos', 'active')
                    ON CONFLICT (tenant_id, user_id) DO UPDATE
                    SET role = 'alumnos',
                        status = 'active';
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG 'Error vinculando usuario para estudiante %: %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Backfill RPC aligned to new domain
CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_student RECORD;
    v_rut_clean TEXT;
    v_rut_body TEXT;
    v_email TEXT;
    v_pass TEXT;
    v_user_id UUID;
    v_created INT := 0;
    v_linked INT := 0;
    v_errors INT := 0;
BEGIN
    FOR r_student IN
        SELECT s.*
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id
          AND s.rut IS NOT NULL
          AND btrim(s.rut) <> ''
    LOOP
        BEGIN
            v_rut_clean := lower(regexp_replace(r_student.rut, '[^0-9kK]', '', 'g'));
            IF length(v_rut_clean) < 2 THEN
                CONTINUE;
            END IF;

            v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
            v_email := v_rut_body || '@estudiantes.kurso';
            v_pass := CASE
                WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
                WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
                ELSE '123456'
            END;

            SELECT id INTO v_user_id
            FROM auth.users
            WHERE email = v_email;

            IF v_user_id IS NULL THEN
                v_user_id := public.create_db_user(
                    v_email,
                    v_pass,
                    jsonb_build_object(
                        'full_name', trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, '')),
                        'rut', r_student.rut,
                        'role', 'alumnos'
                    )
                );
                v_created := v_created + 1;
            END IF;

            INSERT INTO public.app_users (id, email, full_name)
            VALUES (v_user_id, v_email, trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, '')))
            ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email,
                full_name = EXCLUDED.full_name;

            INSERT INTO public.user_roles (user_id, role, first_login, user_name)
            VALUES (
                v_user_id,
                'alumnos',
                TRUE,
                trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
            )
            ON CONFLICT (user_id) DO UPDATE
            SET role = 'alumnos',
                user_name = EXCLUDED.user_name;

            INSERT INTO public.user_students (user_id, student_id, display_name)
            VALUES (
                v_user_id,
                r_student.id,
                trim(coalesce(r_student.first_name, '') || ' ' || coalesce(r_student.last_name, ''))
            )
            ON CONFLICT (user_id, student_id) DO UPDATE
            SET display_name = EXCLUDED.display_name;

            IF FOUND THEN
                v_linked := v_linked + 1;
            END IF;

            INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
            VALUES (p_tenant_id, v_user_id, 'alumnos', 'active')
            ON CONFLICT (tenant_id, user_id) DO UPDATE
            SET role = 'alumnos',
                status = 'active';
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            RAISE LOG 'Error procesando estudiante %: %', r_student.id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'created', v_created,
        'linked', v_linked,
        'errors', v_errors
    );
END;
$$;


-- ============================================================================
-- SOURCE: 20260308_prevent_duplicate_student_rut.sql
-- ============================================================================

-- ============================================================
-- Prevent duplicate student RUTs (global)
-- Date: 2026-03-08
-- ============================================================

CREATE OR REPLACE FUNCTION public.tr_prevent_duplicate_student_rut()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rut_norm TEXT;
BEGIN
  IF NEW.rut IS NULL OR btrim(NEW.rut) = '' THEN
    RETURN NEW;
  END IF;

  v_rut_norm := upper(regexp_replace(NEW.rut, '[^0-9kK]', '', 'g'));

  IF EXISTS (
    SELECT 1
    FROM public.students s
    WHERE upper(regexp_replace(s.rut, '[^0-9kK]', '', 'g')) = v_rut_norm
      AND (TG_OP = 'INSERT' OR s.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Ya existe un alumno con ese RUT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_duplicate_student_rut ON public.students;
CREATE TRIGGER tr_prevent_duplicate_student_rut
BEFORE INSERT OR UPDATE OF rut ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.tr_prevent_duplicate_student_rut();


-- ============================================================================
-- SOURCE: 20260308_unify_student_account_flows.sql
-- ============================================================================

-- ============================================================
-- Unify student account flows (single student + batch)
-- Date: 2026-03-08
-- ============================================================

-- Canonical helpers: one email format + one initial password policy
CREATE OR REPLACE FUNCTION public.student_auth_email_from_rut(p_rut TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rut_clean TEXT;
  v_rut_body TEXT;
BEGIN
  v_rut_clean := lower(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));
  IF length(v_rut_clean) < 2 THEN
    RETURN NULL;
  END IF;

  v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
  RETURN v_rut_body || '@estudiantes.kurso';
END;
$$;

CREATE OR REPLACE FUNCTION public.student_auth_initial_password_from_rut(p_rut TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rut_clean TEXT;
  v_rut_body TEXT;
BEGIN
  v_rut_clean := lower(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));
  IF length(v_rut_clean) < 2 THEN
    RETURN NULL;
  END IF;

  v_rut_body := substring(v_rut_clean from 1 for length(v_rut_clean) - 1);
  RETURN CASE
    WHEN length(v_rut_body) >= 6 THEN substring(v_rut_body from 1 for 6)
    WHEN length(v_rut_body) >= 4 THEN substring(v_rut_body from 1 for 4)
    ELSE '123456'
  END;
END;
$$;

-- Canonical flow for one student
CREATE OR REPLACE FUNCTION public.ensure_student_account(p_student_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_email TEXT;
  v_pass TEXT;
  v_user_id UUID;
  v_created BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_student
  FROM public.students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'student_not_found',
      'student_id', p_student_id
    );
  END IF;

  IF v_student.rut IS NULL OR btrim(v_student.rut) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'student_without_rut',
      'student_id', p_student_id
    );
  END IF;

  v_email := public.student_auth_email_from_rut(v_student.rut);
  v_pass := public.student_auth_initial_password_from_rut(v_student.rut);

  IF v_email IS NULL OR v_pass IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_rut',
      'student_id', p_student_id
    );
  END IF;

  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := public.create_db_user(
      v_email,
      v_pass,
      jsonb_build_object(
        'full_name', trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')),
        'rut', v_student.rut,
        'role', 'alumnos'
      )
    );
    v_created := TRUE;
  END IF;

  INSERT INTO public.app_users (id, email, full_name)
  VALUES (
    v_user_id,
    v_email,
    trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, ''))
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;

  INSERT INTO public.user_roles (user_id, role, first_login, user_name)
  VALUES (
    v_user_id,
    'alumnos',
    TRUE,
    trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, ''))
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'alumnos',
      user_name = EXCLUDED.user_name;

  INSERT INTO public.user_students (user_id, student_id, display_name)
  VALUES (
    v_user_id,
    v_student.id,
    trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, ''))
  )
  ON CONFLICT (user_id, student_id) DO UPDATE
  SET display_name = EXCLUDED.display_name;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  VALUES (
    v_student.tenant_id,
    v_user_id,
    'alumnos',
    'active'
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = 'alumnos',
      status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'created', v_created,
    'student_id', v_student.id,
    'user_id', v_user_id,
    'email', v_email
  );
END;
$$;

-- Batch flow reusing canonical single-student function
CREATE OR REPLACE FUNCTION public.generate_missing_accounts(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_student RECORD;
  v_result JSONB;
  v_created INT := 0;
  v_linked INT := 0;
  v_errors INT := 0;
BEGIN
  FOR r_student IN
    SELECT id
    FROM public.students
    WHERE tenant_id = p_tenant_id
      AND rut IS NOT NULL
      AND btrim(rut) <> ''
  LOOP
    BEGIN
      v_result := public.ensure_student_account(r_student.id);

      IF coalesce((v_result->>'success')::boolean, FALSE) = FALSE THEN
        v_errors := v_errors + 1;
      ELSIF coalesce((v_result->>'created')::boolean, FALSE) = TRUE THEN
        v_created := v_created + 1;
      ELSE
        v_linked := v_linked + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE LOG 'Error processing student %: %', r_student.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'created', v_created,
    'linked', v_linked,
    'errors', v_errors
  );
END;
$$;

-- Keep legacy function name aligned with canonical email policy
CREATE OR REPLACE FUNCTION public.create_auth_user_from_rut(
  p_rut TEXT,
  p_first_name TEXT,
  p_last_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_pass TEXT;
  v_user_id UUID;
BEGIN
  v_email := public.student_auth_email_from_rut(p_rut);
  v_pass := public.student_auth_initial_password_from_rut(p_rut);

  IF v_email IS NULL OR v_pass IS NULL THEN
    RAISE EXCEPTION 'RUT inválido: %', p_rut;
  END IF;

  v_user_id := public.create_db_user(
    v_email,
    v_pass,
    jsonb_build_object(
      'full_name', trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')),
      'rut', p_rut,
      'role', 'alumnos'
    )
  );

  RETURN v_user_id;
END;
$$;

-- Disable auto-creation trigger to preserve explicit UI flow semantics:
--   - Nuevo Alumno + checkbox => create account
--   - Generar Cuentas Faltantes => batch create accounts
DROP TRIGGER IF EXISTS tr_student_create_auth_account ON public.students;
