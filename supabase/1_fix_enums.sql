-- STEP 1: FIX ENUMS
-- Run this script alone first.
-- This ensures the new values are committed before we use them in tables.

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'master';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'alumnos';
