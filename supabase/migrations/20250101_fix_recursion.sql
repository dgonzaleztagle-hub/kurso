-- ==============================================================================
-- FIX INFINITE RECURSION IN RLS
-- ==============================================================================

-- 1. Asegurar función SECURITY DEFINER para chequear SuperAdmin sin RLS
CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos del creador (admin), ignorando RLS
SET search_path = public -- Seguridad para evitar inyecciones
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_users 
        WHERE id = auth.uid() 
        AND is_superadmin = true
    );
END;
$$;

-- 2. Corregir TENANT_MEMBERS (Usar la función segura)
DROP POLICY IF EXISTS "SuperAdmin view all members" ON public.tenant_members;
CREATE POLICY "SuperAdmin view all members" ON public.tenant_members
    FOR SELECT
    USING ( public.check_is_superadmin() );

DROP POLICY IF EXISTS "SuperAdmin manage all members" ON public.tenant_members;
-- Nota: Para INSERT/UPDATE mantenemos la lógica pero usando la función
CREATE POLICY "SuperAdmin manage all members" ON public.tenant_members
    FOR ALL
    USING ( public.check_is_superadmin() )
    WITH CHECK ( public.check_is_superadmin() );

-- Re-aplicar política de Admin/Owner (sin cambiar, pero asegurando orden)
-- Esta política NO causa recursión directa por sí misma si tenant_members no mira a app_users con RLS
-- Como tenant_members ahora usa check_is_superadmin (que salta RLS), se rompe el ciclo.

-- 3. Corregir APP_USERS (Visibilidad entre miembros)
-- El ciclo era User -> TenantMembers -> User(SuperAdminCheck).
-- Al romper el paso 2 (TenantMembers -> User usa Function), este paso 3 ya debería ser seguro.
-- Pero por si acaso, optimizamos para evitar JOINs innecesarios si es self-view.

DROP POLICY IF EXISTS "Tenant members can view profiles of other members" ON public.app_users;
CREATE POLICY "Tenant members can view profiles of other members"
ON public.app_users
FOR SELECT
TO authenticated
USING (
    -- Ver mi propio perfil (siempre permitido, muy rápido)
    id = auth.uid()
    OR
    -- Ver perfil de superadmin (opcional, devuelvo true si soy superadmin para ver todo)
    public.check_is_superadmin()
    OR
    -- Ver compañeros de tenant
    EXISTS (
        SELECT 1 
        FROM public.tenant_members as my_tm
        JOIN public.tenant_members as their_tm ON my_tm.tenant_id = their_tm.tenant_id
        WHERE my_tm.user_id = auth.uid()
        AND their_tm.user_id = app_users.id
    )
);
