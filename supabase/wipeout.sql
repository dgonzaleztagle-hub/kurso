/*
  🚨 DANGER ZONE: SUPABASE WIPEOUT SCRIPT 🚨
  
  Este script ELIMINA TODO el contenido del esquema 'public'.
  Tablas, Vistas, Funciones, Tipos, Enums, etc.
  
  Úsalo con extrema precaución.
*/

BEGIN;

-- 1. Eliminar todas las tablas
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS "public"."' || r.tablename || '" CASCADE';
    END LOOP;
END $$;

-- 2. Eliminar todas las vistas
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS "public"."' || r.viewname || '" CASCADE';
    END LOOP;
END $$;

-- 3. Eliminar todas las vistas materializadas
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT matviewname FROM pg_matviews WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS "public"."' || r.matviewname || '" CASCADE';
    END LOOP;
END $$;

-- 4. Eliminar todas las funciones (rutinas)
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS "public"."' || r.proname || '" CASCADE';
    END LOOP;
END $$;

-- 5. Eliminar todos los tipos (enums, composites)
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype IN ('e', 'c', 'd')) LOOP
        EXECUTE 'DROP TYPE IF EXISTS "public"."' || r.typname || '" CASCADE';
    END LOOP;
END $$;

COMMIT;

-- Verificación final (debería estar vacío)
SELECT * FROM pg_tables WHERE schemaname = 'public';
