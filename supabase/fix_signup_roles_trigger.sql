-- ACTUALIZACIÓN DEL TRIGGER DE BIENVENIDA (VERSIÓN 2)
-- Corrección: first_login = FALSE para auto-registro.
-- El usuario acaba de poner su clave, no tiene sentido pedirle que la cambie.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Crear perfil en app_users
  INSERT INTO public.app_users (id, email, whatsapp_number, full_name, is_superadmin)
  VALUES (
    new.id, 
    new.email, 
    NULLIF(new.raw_user_meta_data->>'whatsapp', ''), 
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    false
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. ASIGNAR ROL INICIAL
  -- Rol: 'master' (Dueño)
  -- First Login: FALSE (Porque se just registered, ya sabe su clave)
  INSERT INTO public.user_roles (user_id, role, first_login)
  VALUES (new.id, 'master', false)  -- <--- CAMBIO AQUÍ
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload config';
