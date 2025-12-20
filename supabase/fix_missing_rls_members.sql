-- FIX RLS: Allow users to view their own memberships
-- Without this, strict RLS returns 0 rows for the user, breaking the dashboard logic.

DROP POLICY IF EXISTS "Users can view own membership" ON public.tenant_members;

CREATE POLICY "Users can view own membership" 
ON public.tenant_members
FOR SELECT
USING (auth.uid() = user_id);
