-- Create meeting_minutes table
CREATE TABLE IF NOT EXISTS public.meeting_minutes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    content TEXT,
    image_url TEXT,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;

-- Policy: Admin/Owner/Master can ALL (CRUD)
CREATE POLICY "Admins can manage meeting minutes"
ON public.meeting_minutes
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.user_id = auth.uid()
        AND tenant_members.tenant_id = meeting_minutes.tenant_id
        AND tenant_members.role IN ('owner', 'admin', 'master')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.user_id = auth.uid()
        AND tenant_members.tenant_id = meeting_minutes.tenant_id
        AND tenant_members.role IN ('owner', 'admin', 'master')
    )
);

-- Policy: Everyone in tenant can SELECT (Read-only)
CREATE POLICY "Members can view meeting minutes"
ON public.meeting_minutes FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.user_id = auth.uid()
        AND tenant_members.tenant_id = meeting_minutes.tenant_id
    )
);

-- Connect Audit Trigger (The one we just created)
CREATE TRIGGER audit_meeting_minutes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.meeting_minutes
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Storage: Create bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-attachments', 'meeting-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Give public read access to meeting attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'meeting-attachments');

CREATE POLICY "Allow uploads for authenticated users"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'meeting-attachments');
