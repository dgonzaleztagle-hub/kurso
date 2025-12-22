-- ==============================================================================
-- FLAT POWER SAFE MODE: SECURITY DEFINER FUNCTIONS
-- ==============================================================================

-- 1. Función Anti-Recursión: Chequear SuperAdmin
CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.app_users 
        WHERE id = auth.uid() 
        AND is_superadmin = true
    );
END;
$$;

-- 2. Función Anti-Recursión: Chequear si soy Admin u Owner de un Tenant específico
CREATE OR REPLACE FUNCTION public.check_is_admin_or_owner(target_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verifica si el usuario actual tiene rol 'owner', 'admin' o 'master' en el tenant objetivo
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = target_tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'master')
    );
END;
$$;

-- 3. Función Anti-Recursión: Chequear si puedo ver a un usuario (Self, Superadmin o Shared Tenant)
CREATE OR REPLACE FUNCTION public.check_can_view_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Soy yo mismo
    IF target_user_id = auth.uid() THEN
        RETURN TRUE;
    END IF;

    -- 2. Soy Superadmin
    IF (SELECT EXISTS(SELECT 1 FROM public.app_users WHERE id = auth.uid() AND is_superadmin = true)) THEN
        RETURN TRUE;
    END IF;

    -- 3. Compartimos un tenant
    RETURN EXISTS (
        SELECT 1 
        FROM public.tenant_members as my_tm
        JOIN public.tenant_members as their_tm ON my_tm.tenant_id = their_tm.tenant_id
        WHERE my_tm.user_id = auth.uid()
        AND their_tm.user_id = target_user_id
    );
END;
$$;

-- ==============================================================================
-- APLICAR POLÍTICAS SEGURAS (Rollback + New Policies)
-- ==============================================================================

-- Desactivar RLS momentáneamente para aplicar cambios sin bloqueos
ALTER TABLE public.app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;

-- --- A. TABLE: TENANTS ---
DROP POLICY IF EXISTS "Admins and Owners can update tenant" ON public.tenants;
CREATE POLICY "Admins and Owners can update tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING ( public.check_is_admin_or_owner(id) )
WITH CHECK ( public.check_is_admin_or_owner(id) );

-- Restore standard read policy if missing (usually handled by linked members)
-- Assuming "Members can view their own tenants" exists. If not, we ensure it safely:
DROP POLICY IF EXISTS "Members can view their own tenants" ON public.tenants;
CREATE POLICY "Members can view their own tenants"
ON public.tenants FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
    )
);


-- --- B. TABLE: TENANT_MEMBERS ---
-- 1. View Memberships
DROP POLICY IF EXISTS "SuperAdmin view all members" ON public.tenant_members;
DROP POLICY IF EXISTS "Emergency: View Own Memberships" ON public.tenant_members; -- Clean emergency
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.tenant_members; -- Old one

CREATE POLICY "Users can view relevant memberships" ON public.tenant_members
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() -- Ver mis membresías
    OR
    public.check_is_superadmin() -- Superadmin ve todo
    OR
    -- Ver miembros de mis tenants (si soy admin/owner/member? Depende de privacidad. 
    -- Generalmente queremos ver compañeros. Usamos shared check o simple tenant match si ya tengo acceso al tenant)
    -- Para evitar complejidad, dejamos que: "Ver miembros si comparto tenant con esa fila"
    -- Pero ojo: La fila de tenant_members tiene (tenant_id, user_id).
    -- Si yo pertenezco a tenant_id, puedo ver esa fila.
    EXISTS (
        SELECT 1 FROM public.tenant_members as my_tm
        WHERE my_tm.tenant_id = tenant_members.tenant_id
        AND my_tm.user_id = auth.uid()
    )
);

-- 2. Manage Members (Insert/Update/Delete) -> Only Admin/Owner
DROP POLICY IF EXISTS "Admins and Owners can manage members" ON public.tenant_members;
DROP POLICY IF EXISTS "SuperAdmin manage all members" ON public.tenant_members;

CREATE POLICY "Admins and Owners can manage members" ON public.tenant_members
FOR ALL TO authenticated
USING (
    public.check_is_superadmin()
    OR
    public.check_is_admin_or_owner(tenant_id)
)
WITH CHECK (
    public.check_is_superadmin()
    OR
    public.check_is_admin_or_owner(tenant_id)
);


-- --- C. TABLE: APP_USERS ---
DROP POLICY IF EXISTS "Tenant members can view profiles of other members" ON public.app_users;
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.app_users;
DROP POLICY IF EXISTS "Emergency: View Own Profile" ON public.app_users;
DROP POLICY IF EXISTS "Emergency: Update Own Profile" ON public.app_users;

-- 1. View Profiles (The dangerous one!)
CREATE POLICY "Safe View Profiles" ON public.app_users
FOR SELECT TO authenticated
USING ( public.check_can_view_user(id) );

-- 2. Update Own Profile (Standard)
CREATE POLICY "Update Own Profile" ON public.app_users
FOR UPDATE TO authenticated
USING ( id = auth.uid() )
WITH CHECK ( id = auth.uid() );


-- Reactivar RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
