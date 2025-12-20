-- STEP 2: RESTORE STRUCTURE
-- Run this script AFTER running 1_fix_enums.sql successfully.

-- 1. Restore the missing table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    user_name TEXT,
    position TEXT,
    phone TEXT,
    first_login BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Configure Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());
    
DROP POLICY IF EXISTS "Masters can read all roles" ON public.user_roles;
CREATE POLICY "Masters can read all roles" ON public.user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'master'
        )
    );

-- 3. Re-create the Helper Function (RPC)
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

    -- Check Master
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = current_user_id AND role = 'master'
    ) INTO is_master;

    -- Check Owner
    SELECT EXISTS (
        SELECT 1 FROM public.tenants WHERE owner_id = current_user_id
        UNION
        SELECT 1 FROM public.tenant_members WHERE user_id = current_user_id AND role = 'owner'
    ) INTO is_owner;

    IF NOT (is_master OR is_owner) THEN
        RAISE EXCEPTION 'Access Denied: Only Master or Owners can list users details.';
    END IF;

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
