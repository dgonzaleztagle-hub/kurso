-- VERIFY USER STATE (FIXED)
-- Checks if the user exists, has a profile, and owns any courses.
-- Usage: Replace 'demo@demo.cl' if checking a different user.

WITH target_user AS (
    SELECT id, email 
    FROM auth.users 
    WHERE email = 'demo@demo.cl' -- <--- EMAIL TARGET
)
SELECT 
    '1. Auth & App User' as section,
    u.email,
    COALESCE(au.full_name, 'NO PROFILE') as info_1,
    COALESCE(au.whatsapp_number, 'NO WSP') as info_2,
    CASE WHEN au.id IS NOT NULL THEN 'OK' ELSE 'MISSING' END as status
FROM target_user u
LEFT JOIN public.app_users au ON u.id = au.id

UNION ALL

SELECT 
    '2. Tenant Ownership' as section,
    t.name as info_1,
    t.slug as info_2,
    t.subscription_status::text as info_3, -- Cast enum to text
    'OK' as status
FROM target_user u
JOIN public.tenants t ON t.owner_id = u.id

UNION ALL

SELECT 
    '3. Membership' as section,
    t.name as info_1,
    tm.role::text as info_2, -- Cast enum to text
    tm.status as info_3,
    'OK' as status
FROM target_user u
JOIN public.tenant_members tm ON tm.user_id = u.id
JOIN public.tenants t ON tm.tenant_id = t.id;
