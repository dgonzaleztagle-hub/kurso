-- ==============================================================================
-- EMERGENCY ROLLBACK: FIX INFINITE RECURSION
-- ==============================================================================

-- 1. Deshabilitar RLS temporalmente para limpiar políticas sin bloqueos
ALTER TABLE public.app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas problemáticas (Limpieza Profunda)
-- Policies on app_users
DROP POLICY IF EXISTS "Tenant members can view profiles of other members" ON public.app_users;
DROP POLICY IF EXISTS "SuperAdmins can view all profiles" ON public.app_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.app_users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.app_users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.app_users; -- Si existía

-- Policies on tenant_members
DROP POLICY IF EXISTS "Admins and Owners can manage members" ON public.tenant_members;
DROP POLICY IF EXISTS "SuperAdmin view all members" ON public.tenant_members;
DROP POLICY IF EXISTS "SuperAdmin manage all members" ON public.tenant_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.tenant_members;

-- 3. Restaurar Políticas "A Prueba de Balas" (Sin Recursión)

-- A. APP_USERS: Simple y Directo
-- Solo yo veo mi perfil. Superadmin ve todo (pero hardcodeado en la query o via funcion segura si existe, por ahora solo ID).
CREATE POLICY "Emergency: View Own Profile" ON public.app_users
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Emergency: Update Own Profile" ON public.app_users
FOR UPDATE USING (id = auth.uid());

-- B. TENANT_MEMBERS: Simple
-- Solo veo mis membresías.
CREATE POLICY "Emergency: View Own Memberships" ON public.tenant_members
FOR SELECT USING (user_id = auth.uid());

-- 4. Reactivar RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- Nota: Esto recupera el LOGIN y el DASHBOARD.
-- Las funciones avanzadas de "Ver lista de usuarios del curso" estaran restringidas momentaneamente
-- hasta que apliquemos el fix definitivo de SECURITY DEFINER, pero priorizamos levantar el sistema.
