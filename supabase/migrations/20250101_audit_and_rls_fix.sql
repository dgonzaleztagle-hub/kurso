-- 1. Crear tabla inmutable de LOGS DE AUDITORÍA
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,           -- Ej: "DELETE PAYMENT", "UPDATE STUDENT"
    entity_name TEXT NOT NULL,      -- Ej: "payments", "students"
    entity_id TEXT NOT NULL,        -- ID del registro afectado
    details JSONB DEFAULT '{}'::jsonb, -- Datos previos o detalles del cambio
    ip_address TEXT,                -- Opcional: IP del usuario
    user_email TEXT                 -- Para lectura rápida sin JOINs
);

-- 2. Proteger la tabla (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: TODOS los usuarios autenticados pueden INSERTAR (registrar acciones)
CREATE POLICY "Users can insert audit logs" 
ON public.audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Política: SOLO Master/Owner puede VER los logs (para auditar)
CREATE POLICY "Admins/Owners can view audit logs" 
ON public.audit_logs FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('master', 'admin') -- Ajustar según roles finales
    )
    OR 
    EXISTS (
        SELECT 1 FROM public.tenants 
        WHERE tenants.owner_id = auth.uid()
    )
);

-- CRÍTICO: Política de "SOLO LECTURA/INSERCIÓN". Nadie puede borrar ni editar logs.
-- No creamos policies FOR UPDATE ni FOR DELETE. Por defecto Supabase las niega.

-- 3. Arreglar el Error 406 (Recursión en user_roles)
-- Borramos la política vieja que causaba el bucle
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Masters can read all roles" ON public.user_roles;

-- Creamos una política SIMPLE y DIRECTA
-- "Cualquier usuario puede ver SU PROPIA fila. Punto."
CREATE POLICY "Read own role simple" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- "Los Owners de Tenants pueden ver los roles de TODOS en su sistema"
-- (Esto evita la recursión porque no consulta user_roles para validar, sino tenants)
CREATE POLICY "Tenant Owners view all roles" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.tenants 
        WHERE tenants.owner_id = auth.uid()
    )
);

-- 4. Recargar configuración para aplicar cambios
NOTIFY pgrst, 'reload config';
