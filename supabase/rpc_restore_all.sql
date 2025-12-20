-- RESTORE USER_ROLES TABLE
-- This table is required for the legacy Permission System and the new RPC.
-- Run this in Supabase SQL Editor.

-- FIX ENUM FIRST: Ensure 'master' and 'alumnos' exist in app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'master';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'alumnos';

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    user_name TEXT,
    position TEXT,
    phone TEXT,
    first_login BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: One role per user (Global Model)
    -- In multi-tenant, this table might be deprecated later, but currently used heavily.
    UNIQUE(user_id)
);

-- Enable RLS just in case, though RPC uses SECURITY DEFINER
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own role
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());
    
-- Allow Masters to read all roles
DROP POLICY IF EXISTS "Masters can read all roles" ON public.user_roles;
CREATE POLICY "Masters can read all roles" ON public.user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'master'
        )
    );

--------------------------------------------------------------------------------
-- RE-APPLY THE RPC FUNCTION (To ensure it binds to the new table)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_users_managed_by_me()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    is_master boolean;
    is_owner boolean;
    result json;
BEGIN
    current_user_id := auth.uid();

    -- 1. Check if user is Master (Global)
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = current_user_id AND role = 'master'
    ) INTO is_master;

    -- 2. Check if user is Owner (Global or Tenant Member)
    SELECT EXISTS (
        SELECT 1 FROM public.tenants WHERE owner_id = current_user_id
        UNION
        SELECT 1 FROM public.tenant_members WHERE user_id = current_user_id AND role = 'owner'
    ) INTO is_owner;

    -- 3. Authorization Gate
    IF NOT (is_master OR is_owner) THEN
        RAISE EXCEPTION 'Access Denied: Only Master or Owners can list users details.';
    END IF;

    -- 4. Fetch Users Data
    SELECT json_build_object(
        'users', COALESCE(
            json_agg(
                json_build_object(
                    'id', ur.user_id,
                    'role', ur.role,
                    'roleId', ur.id,
                    'email', au.email,
                    'name', au.full_name,
                    'userName', ur.user_name,
                    'position', ur.position,
                    'phone', ur.phone,
                    'displayName', us.display_name,
                    'studentId', us.student_id,
                    'studentLinkId', us.id
                )
            ),
            '[]'::json
        )
    ) INTO result
    FROM public.user_roles ur
    JOIN public.app_users au ON ur.user_id = au.id
    LEFT JOIN public.user_students us ON ur.user_id = us.user_id;

    RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_users_managed_by_me IS 'Returns users with roles for Masters/owners. Recreates user_roles dependency.';
