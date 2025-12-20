-- FIX: Allow deleting Users who own Tenants
-- Currently, deleting a user fails because they are referenced in 'tenants.owner_id'.
-- This script changes the Foreign Key to ON DELETE CASCADE.
-- WARNING: Deleting a user will now DELETE ALL THEIR COURSES/TENANTS automatically.

ALTER TABLE public.tenants
DROP CONSTRAINT IF EXISTS tenants_owner_id_fkey;

ALTER TABLE public.tenants
ADD CONSTRAINT tenants_owner_id_fkey
FOREIGN KEY (owner_id)
REFERENCES public.app_users(id)
ON DELETE CASCADE;
