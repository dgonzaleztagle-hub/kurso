/*
  SYNC AUTOMÁTICO DE USUARIOS (SMART FIX)
  ---------------------------------------
  Este script busca TODOS los usuarios que existen en Auth pero faltan en la App,
  y los restaura automáticamente como SuperAdministradores.
  
  NO NECESITAS PONER TU EMAIL. SOLO EJECÚTALO.
*/

INSERT INTO public.app_users (id, email, whatsapp_number, full_name, is_superadmin)
SELECT 
    au.id, 
    au.email, 
    '00000', -- Placeholder para whatsapp
    COALESCE(au.raw_user_meta_data->>'full_name', 'Recuperado'), 
    true     -- Los hacemos SuperAdmin por defecto para recuperar acceso
FROM auth.users au
LEFT JOIN public.app_users ap ON au.id = ap.id
WHERE ap.id IS NULL;

-- Confirmación: Mostrar los usuarios recuperados
SELECT * FROM public.app_users;
