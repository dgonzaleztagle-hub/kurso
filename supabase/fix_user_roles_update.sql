-- HABILITAR ACTUALIZACIÓN DE ROLES (Autoservicio)
-- Este script permite que un usuario modifique SU PROPIA fila en user_roles.
-- Es necesario para que puedan cambiar 'first_login' de true a false.

-- 1. Política de UPDATE para el propio usuario
CREATE POLICY "Users can update own role" 
ON public.user_roles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Asegurar que las políticas previos sigan bien (Reload)
NOTIFY pgrst, 'reload config';
