-- FIX DEFINITIVO DE PERMISOS SUPERADMIN
-- Ejecuta este script en el Editor SQL de Supabase para desbloquear la creación de cursos.

-- 1. Habilitar RLS en tablas críticas (por si acaso)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "SuperAdmin view all orgs" ON public.organizations;
DROP POLICY IF EXISTS "SuperAdmin manage all orgs" ON public.organizations;
DROP POLICY IF EXISTS "SuperAdmin view all tenants" ON public.tenants;
DROP POLICY IF EXISTS "SuperAdmin manage all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can create tenants" ON public.tenants;

-- 3. Crear Política MAESTRA para Organizaciones
CREATE POLICY "SuperAdmin manage all orgs" ON public.organizations
    FOR ALL
    USING (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    )
    WITH CHECK (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    );

-- 4. Crear Política MAESTRA para Tenants (Cursos)
-- Esta es la que estaba fallando (INSERT)
CREATE POLICY "SuperAdmin manage all tenants" ON public.tenants
    FOR ALL
    USING (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    )
    WITH CHECK (
        (SELECT is_superadmin FROM public.app_users WHERE id = auth.uid()) = true
    );

-- 5. Verificar que el usuario actual sea SuperAdmin
-- (Sustituye 'tu-email' si lo necesitas, pero el script anterior ya debió hacerlo)
-- UPDATE public.app_users SET is_superadmin = true WHERE email = 'dgonzalez.tagle@gmail.com';
