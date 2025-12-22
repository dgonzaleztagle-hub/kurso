-- ==============================================================================
-- FINAL RESTORE STABILITY: NUCLEAR ROLLBACK
-- ==============================================================================
-- Objetivo: Recuperar el acceso al Dashboard a toda costa.
-- Elimina toda lógica compleja de "Flat Power" y "Anti-Recursion".
-- Vuelve a lo básico: Cada usuario ve lo suyo.

-- 1. Desactivar RLS para limpiar
ALTER TABLE public.app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar Funciones Complejas (Limpieza de "Safe Mode" fallido)
DROP FUNCTION IF EXISTS public.check_is_superadmin() CASCADE;
DROP FUNCTION IF EXISTS public.check_is_admin_or_owner(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_can_view_user(UUID) CASCADE;

-- 3. Limpiar Políticas de APP_USERS
DROP POLICY IF EXISTS "Tenant members can view profiles of other members" ON public.app_users;
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.app_users;
DROP POLICY IF EXISTS "Emergency: View Own Profile" ON public.app_users;
DROP POLICY IF EXISTS "Safe View Profiles" ON public.app_users;
DROP POLICY IF EXISTS "Update Own Profile" ON public.app_users;
DROP POLICY IF EXISTS "Safe Mode: View Own Profile" ON public.app_users;

-- NUEVA POLÍTICA SIMPLE (APP_USERS)
CREATE POLICY "Restore: View Own Profile" ON public.app_users
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Restore: Update Own Profile" ON public.app_users
FOR UPDATE USING (id = auth.uid());

-- 4. Limpiar Políticas de TENANT_MEMBERS
DROP POLICY IF EXISTS "Admins and Owners can manage members" ON public.tenant_members;
DROP POLICY IF EXISTS "SuperAdmin view all members" ON public.tenant_members;
DROP POLICY IF EXISTS "SuperAdmin manage all members" ON public.tenant_members;
DROP POLICY IF EXISTS "Users can view relevant memberships" ON public.tenant_members;
DROP POLICY IF EXISTS "Emergency: View Own Memberships" ON public.tenant_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.tenant_members;
DROP POLICY IF EXISTS "Safe Mode: View Own Memberships" ON public.tenant_members;

-- NUEVA POLÍTICA SIMPLE (TENANT_MEMBERS)
CREATE POLICY "Restore: View Own Memberships" ON public.tenant_members
FOR SELECT USING (user_id = auth.uid());

-- 5. Limpiar Políticas de TENANTS
DROP POLICY IF EXISTS "Admins and Owners can update tenant" ON public.tenants;
DROP POLICY IF EXISTS "Members can view their own tenants" ON public.tenants;

-- NUEVA POLÍTICA SIMPLE (TENANTS)
-- Permite ver tenants donde soy miembro (sin roles complejos)
CREATE POLICY "Restore: View My Tenants" ON public.tenants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
    )
);

-- Solo Owner puede editar (Volvemos al default seguro por hoy)
CREATE POLICY "Restore: Owner Updates Tenant" ON public.tenants
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'owner'
    )
);

-- 6. Reactivar RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Verificación final: Si esto corre, el usuario 123 solo ve al usuario 123.
-- No hay bucles posibles.
