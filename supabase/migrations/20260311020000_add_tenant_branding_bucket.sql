insert into storage.buckets (id, name, public)
values ('tenant-branding', 'tenant-branding', true)
on conflict (id) do nothing;

DROP POLICY IF EXISTS "tenant_branding_select_auth" ON storage.objects;
CREATE POLICY "tenant_branding_select_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tenant-branding');

DROP POLICY IF EXISTS "tenant_branding_insert_auth" ON storage.objects;
CREATE POLICY "tenant_branding_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-branding');

DROP POLICY IF EXISTS "tenant_branding_update_auth" ON storage.objects;
CREATE POLICY "tenant_branding_update_auth"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-branding')
WITH CHECK (bucket_id = 'tenant-branding');

DROP POLICY IF EXISTS "tenant_branding_delete_auth" ON storage.objects;
CREATE POLICY "tenant_branding_delete_auth"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tenant-branding');
