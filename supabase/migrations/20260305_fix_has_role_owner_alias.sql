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
