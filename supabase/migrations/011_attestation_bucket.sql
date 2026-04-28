-- ═══════════════════════════════════════════════════════════════
-- 011 — Storage bucket for attestation PDFs + RLS policies
-- ═══════════════════════════════════════════════════════════════
--
-- The bucket creation in 007 was commented out, so uploads were
-- silently failing and attestation_url remained null.

-- 1. Create the private attestations bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attestations',
  'attestations',
  false,
  5242880,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow any authenticated or anonymous user to upload a PDF
--    (clients upload during booking confirmation, including guest users)
CREATE POLICY "upload_attestation" ON storage.objects
  FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id = 'attestations');

-- 3. Allow authenticated users (admin, drivers, clients) to read
--    (needed for createSignedUrl on the client side)
CREATE POLICY "read_attestation" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attestations');

-- 4. Allow update/delete by admins only
CREATE POLICY "admin_manage_attestation" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'attestations' AND is_admin())
  WITH CHECK (bucket_id = 'attestations' AND is_admin());
