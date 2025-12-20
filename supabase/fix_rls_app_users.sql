/*
  FIX RLS POLICIES (APP_USERS)
  ----------------------------
  La tabla app_users tiene RLS activado, pero parece faltar la política 
  que permite a los usuarios leer su propio perfil.
  Esto puede causar errores al intentar autenticar.
*/

-- 1. Asegurar que RLS está activo (por seguridad)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas para evitar duplicados
DROP POLICY IF EXISTS "Users can view own profile" ON public.app_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.app_users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.app_users;

-- 3. Crear política de LECTURA: "Solo yo puedo ver mi perfil"
CREATE POLICY "Users can view own profile" 
ON public.app_users 
FOR SELECT 
USING (auth.uid() = id);

-- 4. Crear política de ACTUALIZACIÓN: "Solo yo puedo editar mi perfil"
CREATE POLICY "Users can update own profile" 
ON public.app_users 
FOR UPDATE 
USING (auth.uid() = id);

-- 5. (Opcional/Debug) Permitir lectura pública temporalmente SI FALLA LO ANTERIOR
-- Descomenta la siguiente línea solo si sigues con error 406
-- CREATE POLICY "Debug Public Read" ON public.app_users FOR SELECT USING (true);
