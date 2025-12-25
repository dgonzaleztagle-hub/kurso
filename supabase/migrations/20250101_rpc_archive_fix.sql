-- ==============================================================================
-- FIX: PERMITE AL OWNER ARCHIVAR SU TENANT (BYPASSING RLS)
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de Supabase para crear la función segura.

CREATE OR REPLACE FUNCTION public.archive_tenant(target_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- IMPORTANTE: Esto le da permisos de "Superusuario" a la función
SET search_path = public
AS $$
DECLARE
    is_owner BOOLEAN;
BEGIN
    -- 1. Verificación manual de que eres el Dueño (para seguridad)
    -- Consultamos directamente la tabla de miembros
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = target_tenant_id
        AND user_id = auth.uid()
        AND role = 'owner'
    ) INTO is_owner;

    IF NOT is_owner THEN
        RAISE EXCEPTION 'Acceso Denegado: Solo el Owner puede archivar el curso.';
    END IF;

    -- 2. Ejecutar la actualización con poder absoluto
    UPDATE public.tenants
    SET status = 'archived'
    WHERE id = target_tenant_id;

    -- 3. Verificación final
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el curso o no se pudo actualizar.';
    END IF;
END;
$$;
