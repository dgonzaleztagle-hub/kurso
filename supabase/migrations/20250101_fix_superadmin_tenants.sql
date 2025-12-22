-- Allow SuperAdmins to UPDATE tenants
-- This is critical for assigning owners or updating settings from the Admin Panel.

CREATE POLICY "SuperAdmins can update tenants"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  public.check_is_superadmin()
)
WITH CHECK (
  public.check_is_superadmin()
);
