-- SEED DATA (Demo)
-- Ejecutar despues de crear autenticacion (necesitas un auth.uid() valido o hacerlo manualmente)

-- 1. Crear Organización Demo
INSERT INTO public.organizations (name, plan_type)
VALUES ('Colegio San Demo', 'institutional');

-- 2. Crear Tenant Demo (Curso)
-- Nota: Necesitas reemplazar 'OWNER_UUID_HERE' por el ID de tu usuario auth
-- INSERT INTO public.tenants (name, slug, organization_id, owner_id)
-- VALUES ('1° Básico A', '1-basico-a', (SELECT id FROM organizations LIMIT 1), 'OWNER_UUID_HERE');
