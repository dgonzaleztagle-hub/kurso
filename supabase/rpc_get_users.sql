-- FUNCTION: get_users_managed_by_me()
-- PURPOSE: Allows Master and Owners (Tenant/Organization) to list users with roles.
-- REPLACES: Supabase Edge Function 'get-users-with-roles'.
-- DEPLOY: Paste this into Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.get_users_managed_by_me()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Allows checking tables even if RLS would block
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
    -- Returns same structure as the Edge Function expected: { "users": [...] }
    SELECT json_build_object(
        'users', COALESCE(
            json_agg(
                json_build_object(
                    'id', ur.user_id,
                    'role', ur.role,
                    'roleId', ur.id,
                    'email', au.email, -- From app_users (synced from auth)
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
