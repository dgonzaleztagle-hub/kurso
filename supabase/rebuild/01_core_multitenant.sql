-- ============================================================================
-- KURSO REBUILD - ETAPA 1 (CORE MULTITENANT)
-- Proyecto destino: wkwztjpvtsmwvgumywfi
-- Objetivo: dejar operativo auth + tenants + onboarding
-- ============================================================================

create extension if not exists pgcrypto;

-- 1) Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('owner','master','admin','member','student','alumnos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('trial','active','past_due','canceled','grace_period','locked');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
    CREATE TYPE public.plan_type AS ENUM ('basic','institutional');
  END IF;
END $$;

-- 2) Core tables
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  whatsapp_number text UNIQUE,
  avatar_url text,
  is_superadmin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  director_contact text,
  plan_type public.plan_type DEFAULT 'institutional',
  valid_until date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  name text NOT NULL,
  slug text UNIQUE,
  owner_id uuid REFERENCES public.app_users(id),
  subscription_status public.subscription_status DEFAULT 'trial',
  trial_ends_at timestamptz DEFAULT (now() + interval '7 days'),
  valid_until date,
  settings jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active' CHECK (status IN ('active','archived','pending_setup')),
  previous_tenant_id uuid REFERENCES public.tenants(id),
  next_tenant_id uuid REFERENCES public.tenants(id),
  fiscal_year integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE,
  role public.app_role DEFAULT 'member',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON public.tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON public.tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_org_id ON public.tenants(organization_id);

-- 3) RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- app_users policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.app_users;
CREATE POLICY "Users can view own profile"
ON public.app_users FOR SELECT
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.app_users;
CREATE POLICY "Users can update own profile"
ON public.app_users FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- tenants policies
DROP POLICY IF EXISTS "Members can view their own tenants" ON public.tenants;
CREATE POLICY "Members can view their own tenants"
ON public.tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenants.id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
  )
  OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "Admins and Owners can update tenant" ON public.tenants;
CREATE POLICY "Admins and Owners can update tenant"
ON public.tenants FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenants.id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin','master')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenants.id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin','master')
  )
);

-- tenant_members policies
DROP POLICY IF EXISTS "Users can view relevant memberships" ON public.tenant_members;
CREATE POLICY "Users can view relevant memberships"
ON public.tenant_members FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tenant_members my_tm
    WHERE my_tm.tenant_id = tenant_members.tenant_id
      AND my_tm.user_id = auth.uid()
      AND my_tm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Admins and Owners can manage members" ON public.tenant_members;
CREATE POLICY "Admins and Owners can manage members"
ON public.tenant_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin','master')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = tenant_members.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('owner','admin','master')
  )
);

-- organizations policies (solo superadmin)
DROP POLICY IF EXISTS "Superadmin manage organizations" ON public.organizations;
CREATE POLICY "Superadmin manage organizations"
ON public.organizations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.id = auth.uid()
      AND au.is_superadmin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.id = auth.uid()
      AND au.is_superadmin = true
  )
);

-- 4) Trigger on auth.users -> app_users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_users (id, email, whatsapp_number, full_name, is_superadmin)
  VALUES (
    new.id,
    new.email,
    NULLIF(new.raw_user_meta_data->>'whatsapp', ''),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) RPC onboarding
CREATE OR REPLACE FUNCTION public.create_own_tenant(
  new_tenant_name text,
  new_institution_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  new_slug text;
  current_user_id uuid;
  default_settings jsonb;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  new_slug := lower(regexp_replace(new_tenant_name, '[^a-zA-Z0-9]+', '-', 'g'));
  new_slug := trim(both '-' from new_slug) || '-' || floor(extract(epoch from now()));

  default_settings := jsonb_build_object('institution_name', COALESCE(new_institution_name, ''));

  INSERT INTO public.tenants (name, slug, owner_id, settings, fiscal_year, status)
  VALUES (
    new_tenant_name,
    new_slug,
    current_user_id,
    default_settings,
    date_part('year', now())::int,
    'active'
  )
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  VALUES (new_tenant_id, current_user_id, 'owner', 'active')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN json_build_object('id', new_tenant_id, 'slug', new_slug);
END;
$$;

-- 6) Helper: get platform clients
CREATE OR REPLACE FUNCTION public.get_platform_clients()
RETURNS TABLE (
  id uuid,
  tenant_name text,
  organization_name text,
  owner_email text,
  owner_name text,
  subscription_status public.subscription_status,
  status text,
  fiscal_year integer,
  valid_until date,
  trial_ends_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name AS tenant_name,
    o.name AS organization_name,
    au.email AS owner_email,
    au.full_name AS owner_name,
    t.subscription_status,
    t.status,
    t.fiscal_year,
    t.valid_until,
    t.trial_ends_at,
    t.created_at
  FROM public.tenants t
  LEFT JOIN public.organizations o ON o.id = t.organization_id
  LEFT JOIN public.app_users au ON au.id = t.owner_id
  ORDER BY t.created_at DESC;
$$;
