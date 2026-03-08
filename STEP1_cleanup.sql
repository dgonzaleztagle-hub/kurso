-- STEP 1: Eliminar usuarios viejos con @kurso.cl
DELETE FROM auth.users 
WHERE email LIKE '%@kurso.cl';

-- Verificar limpieza
SELECT 'Usuarios eliminados' as status, COUNT(*) as count FROM auth.users WHERE email LIKE '%kurso.cl';
