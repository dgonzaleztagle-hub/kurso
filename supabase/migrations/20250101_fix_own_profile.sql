-- ASEGURAR VISIBILIDAD DE PERFIL PROPIO
-- Esta política es redundante pero "a prueba de balas" para evitar que 
-- la lógica compleja de RLS impida al usuario cargar su propia data (y ver si es superadmin).

DROP POLICY IF EXISTS "View Own Profile Simple" ON public.app_users;

CREATE POLICY "View Own Profile Simple"
ON public.app_users
FOR SELECT
TO authenticated
USING ( 
    id = auth.uid() 
);

-- Forzar refresco de caché de esquemas/políticas
NOTIFY pgrst, 'reload schema';
