-- Add status and rollover fields to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'pending_setup')),
ADD COLUMN IF NOT EXISTS previous_tenant_id uuid REFERENCES public.tenants(id),
ADD COLUMN IF NOT EXISTS next_tenant_id uuid REFERENCES public.tenants(id),
ADD COLUMN IF NOT EXISTS fiscal_year integer;

-- Update existing tenants to have a default status and fiscal year (based on creation date)
UPDATE public.tenants
SET 
  status = 'active',
  fiscal_year = date_part('year', created_at)::integer
WHERE status IS NULL;

-- Index for performance on status filtering
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_org_status ON public.tenants(organization_id, status);
