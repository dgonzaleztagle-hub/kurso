-- Storage buckets requeridos por la app
insert into storage.buckets (id, name, public)
values ('reimbursements', 'reimbursements', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('form-uploads', 'form-uploads', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('meeting-attachments', 'meeting-attachments', true)
on conflict (id) do nothing;

-- Policies minimas para usuarios autenticados
-- reimbursements
DROP POLICY IF EXISTS "reimbursements_select_auth" ON storage.objects;
CREATE POLICY "reimbursements_select_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reimbursements');

DROP POLICY IF EXISTS "reimbursements_insert_auth" ON storage.objects;
CREATE POLICY "reimbursements_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reimbursements');

DROP POLICY IF EXISTS "reimbursements_update_auth" ON storage.objects;
CREATE POLICY "reimbursements_update_auth"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'reimbursements')
WITH CHECK (bucket_id = 'reimbursements');

DROP POLICY IF EXISTS "reimbursements_delete_auth" ON storage.objects;
CREATE POLICY "reimbursements_delete_auth"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reimbursements');

-- form-uploads
DROP POLICY IF EXISTS "form_uploads_select_auth" ON storage.objects;
CREATE POLICY "form_uploads_select_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'form-uploads');

DROP POLICY IF EXISTS "form_uploads_insert_auth" ON storage.objects;
CREATE POLICY "form_uploads_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'form-uploads');

DROP POLICY IF EXISTS "form_uploads_update_auth" ON storage.objects;
CREATE POLICY "form_uploads_update_auth"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'form-uploads')
WITH CHECK (bucket_id = 'form-uploads');

DROP POLICY IF EXISTS "form_uploads_delete_auth" ON storage.objects;
CREATE POLICY "form_uploads_delete_auth"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'form-uploads');

-- meeting-attachments
DROP POLICY IF EXISTS "meeting_attachments_select_auth" ON storage.objects;
CREATE POLICY "meeting_attachments_select_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-attachments');

DROP POLICY IF EXISTS "meeting_attachments_insert_auth" ON storage.objects;
CREATE POLICY "meeting_attachments_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'meeting-attachments');

DROP POLICY IF EXISTS "meeting_attachments_update_auth" ON storage.objects;
CREATE POLICY "meeting_attachments_update_auth"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'meeting-attachments')
WITH CHECK (bucket_id = 'meeting-attachments');

DROP POLICY IF EXISTS "meeting_attachments_delete_auth" ON storage.objects;
CREATE POLICY "meeting_attachments_delete_auth"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'meeting-attachments');
