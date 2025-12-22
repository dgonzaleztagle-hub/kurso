-- PROMOCIÓN MANUAL A SUPERADMIN
-- Instrucciones:
-- 1. Reemplaza 'admin@kurso.cl' con el correo exacto de tu usuario.
-- 2. Ejecuta este script.

UPDATE public.app_users
SET is_superadmin = true
WHERE email = 'admin@kurso.cl'; -- <--- PON TU EMAIL AQUI

-- Verificación (Opcional, te mostrará si funcionó)
SELECT email, is_superadmin FROM public.app_users WHERE is_superadmin = true;
