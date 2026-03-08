-- STEP 4: Verificar que auth.users se creó con nuevo dominio
-- Buscar el usuario creado por el trigger
SELECT 
  id,
  email,
  created_at,
  CASE WHEN email LIKE '%@estudiantes.kurso' THEN '✅ Dominio correcto' ELSE '❌ Dominio incorrecto' END as status
FROM auth.users 
WHERE email LIKE '20333444%'
ORDER BY created_at DESC
LIMIT 1;
