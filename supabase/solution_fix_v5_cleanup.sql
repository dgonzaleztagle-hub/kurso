-- ==============================================================================
-- SOLUCIÓN V5: FIX ERROR 406 (ROLES ADMIN)
-- ==============================================================================
-- Instrucciones: Ejecuta esto en SQL Editor.
-- Resuelve: Las líneas rojas "406 Not Acceptable" en la consola.
-- Causa: Tu usuario Administrador no tenía una fila en la tabla 'user_roles'.

-- 1. Asegurar permisos en la tabla (por si se perdieron al restaurar)
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

-- 2. Asegurar política de lectura básica
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

-- 3. Auto-Reparación de tu Usuario Admin
-- Este bloque busca tu usuario actual (si estás logueado en Dashboard) y le crea el rol 'master' si falta.
-- Si no encuentra 'auth.uid()', no hará daño. Pero si eres tú ejecutando, debería funcionar.

DO $$
DECLARE
    v_my_id UUID;
    v_email TEXT;
BEGIN
    -- Intentamos obtener ID del contexto actual (A veces null en editor SQL)
    v_my_id := auth.uid();
    
    -- Si es NULL, intentamos buscar el usuario dueño del tenant (Asumiendo que eres tú el owner)
    IF v_my_id IS NULL THEN
        -- Buscar el primer usuario creado (usualmente el admin) para asegurarnos
        SELECT id, email INTO v_my_id, v_email FROM auth.users ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_my_id IS NOT NULL THEN
        -- Crear App User si falta
        INSERT INTO public.app_users (id, email)
        VALUES (v_my_id, 'admin@kurso.cl') -- Email dummy si no lo tenemos, pero updateará si existe conflicto
        ON CONFLICT (id) DO NOTHING;

        -- Crear Rol Master
        INSERT INTO public.user_roles (user_id, role, first_login, user_name)
        VALUES (v_my_id, 'master', FALSE, 'Admin')
        ON CONFLICT (user_id) DO UPDATE
        SET role = 'master'; -- Forzar master
    END IF;
END $$;
