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
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 days'), -- 7 trial + 3 grace
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
