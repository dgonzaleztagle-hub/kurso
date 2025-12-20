-- Remote Procedure Call (RPC) para crear un Tenant propio
-- Esto permite que un usuario autenticado cree su curso sin tener permisos de INSERT directos en la tabla 'tenants'.
-- Se ejecuta con privilegios de definidor (Security Definer) para bypass de RLS.

CREATE OR REPLACE FUNCTION public.create_own_tenant(new_tenant_name text, new_institution_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id uuid;
  new_slug text;
  current_user_id uuid;
  default_settings jsonb;
BEGIN
  current_user_id := auth.uid();
  
  -- Validar que el usuario exista
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Generar Slug básico
  new_slug := lower(regexp_replace(new_tenant_name, '[^a-zA-Z0-9]+', '-', 'g'));
  new_slug := new_slug || '-' || floor(extract(epoch from now()));
  
  -- Preparar settings con el nombre del colegio
  default_settings := jsonb_build_object('institution_name', new_institution_name);

  -- Insertar el nuevo Tenant
  INSERT INTO public.tenants (name, slug, owner_id, settings)
  VALUES (new_tenant_name, new_slug, current_user_id, default_settings)
  RETURNING id INTO new_tenant_id;

  -- Insertar al usuario como miembro 'owner'
  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  VALUES (new_tenant_id, current_user_id, 'owner', 'active');

  RETURN json_build_object('id', new_tenant_id, 'slug', new_slug);
END;
$$;
