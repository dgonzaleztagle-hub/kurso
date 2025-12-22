-- Función genérica para registrar eventos de auditoría
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
    action TEXT;
    entity_name TEXT;
    entity_id TEXT;
    details JSONB;
BEGIN
    -- Intentar obtener el ID del usuario actual
    -- Si es una operación del sistema o anon, puede ser nulo o '0000...'
    user_id := auth.uid();
    
    -- Si no hay usuario autenticado, intentamos ver si viene en session_user o dejamos NULL
    -- (En triggers RLS, auth.uid() suele funcionar. Si es trigger FOR EACH ROW, corre con permisos del usuario).

    action := TG_OP; -- INSERT, UPDATE, DELETE
    entity_name := TG_TABLE_NAME;
    
    -- Determinar ID y Detalles según la operación
    IF (TG_OP = 'INSERT') THEN
        entity_id := NEW.id::TEXT;
        details := to_jsonb(NEW);
    ELSIF (TG_OP = 'UPDATE') THEN
        entity_id := NEW.id::TEXT;
        -- Guardamos diff: lo que cambió
        details := jsonb_build_object(
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        entity_id := OLD.id::TEXT;
        details := to_jsonb(OLD);
    END IF;

    -- Insertar en log (si hay user_id o queremos loguear sistema también)
    -- Asumiremos que nos interesa loguear todo, incluso si user_id es nulo (acciones del sistema)
    -- Pero para la tabla audit_logs definida, user_id es references auth.users y NOT NULL.
    -- Si auth.uid() es nulo, no podremos insertar si la FK es estricta.
    -- Ajuste: Si auth.uid() es nulo, usaremos un usuario 'System' o saltaremos.
    -- Por seguridad en Supabase, auth.uid() es confiable para acciones vía API.
    
    IF user_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (
            user_id,
            action,
            entity_name,
            entity_id,
            details
        ) VALUES (
            user_id,
            action,
            entity_name,
            entity_id,
            details
        );
    ELSE
        -- Opción: Loguear con un usuario ficticio o simplemente ignorar si es mantenimiento interno
        -- Por ahora ignoramos lo que no tenga usuario (ej. migraciones o superadmin directo sin sesión)
        -- O podríamos castear un UUID '00000000-0000-0000-0000-000000000000' si existe.
        RETURN NULL; 
    END IF;

    RETURN NULL; -- Result is ignored since this is an AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Borrar triggers viejos si existen para evitar duplicados en re-runs
DROP TRIGGER IF EXISTS audit_students_trigger ON public.students;
DROP TRIGGER IF EXISTS audit_payments_trigger ON public.payments;
DROP TRIGGER IF EXISTS audit_expenses_trigger ON public.expenses;
DROP TRIGGER IF EXISTS audit_user_roles_trigger ON public.user_roles;
DROP TRIGGER IF EXISTS audit_activities_trigger ON public.activities;
DROP TRIGGER IF EXISTS audit_tenants_trigger ON public.tenants;

-- Crear Triggers en tablas críticas
CREATE TRIGGER audit_students_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_expenses_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_user_roles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_activities_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Tenants: cambios de configuración
CREATE TRIGGER audit_tenants_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Notificar recarga
NOTIFY pgrst, 'reload config';
