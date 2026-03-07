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
