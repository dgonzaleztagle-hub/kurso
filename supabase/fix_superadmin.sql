/*
  REPARACIÓN DE USUARIO FANTASMA
  ------------------------------
  Si borraste la tabla 'app_users' (wipeout) pero tu usuario sigue logueado (auth.users),
  necesitas regenerar tu perfil manualmente y asignarte permisos.
*/

-- 1. Insertar perfil si no existe (recuperando ID desde auth.users usando el email)
-- REEMPLAZA 'tu_email@gmail.com' CON TU EMAIL REAL
INSERT INTO public.app_users (id, email, whatsapp_number, full_name, is_superadmin)
SELECT 
    id, 
    email, 
    '00000000', -- Whatsapp placeholder
    'Super Admin', 
    true        -- BOOM: SuperAdmin directo
FROM auth.users
WHERE email = 'tu_email@aqui.com' -- <--- PON TU EMAIL AQUI
ON CONFLICT (id) DO UPDATE
SET is_superadmin = true;

-- 2. Asegurar que las tablas de negocio existen (si no corriste el anterior)
-- (El script 20250101_add_business_tables.sql hace esto completo)
