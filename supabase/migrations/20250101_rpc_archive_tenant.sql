-- Function to safely archive a tenant
-- Bypasses RLS by using SECURITY DEFINER, but enforces strict Owner check.

CREATE OR REPLACE FUNCTION public.archive_tenant(target_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Strict Access Control: Must be Owner
    IF NOT public.check_is_owner(target_tenant_id) THEN
        RAISE EXCEPTION 'Access Denied: Only Owners can archive a tenant.';
    END IF;

    -- 2. Perform the Archive
    UPDATE public.tenants
    SET status = 'archived'
    WHERE id = target_tenant_id;

    -- 3. Verification (Optional)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant not found or could not be updated.';
    END IF;
END;
$$;
