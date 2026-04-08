-- ═══════════════════════════════════════════════════════════════
-- 007 — Attestation PDF & Broadcast
-- ═══════════════════════════════════════════════════════════════

-- 1. PDF attestation URL (course conventionnée)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attestation_url text;

-- 2. Broadcast flag: course envoyée à tous les chauffeurs
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_broadcast boolean DEFAULT false NOT NULL;

-- 3. Index for fast broadcast queries
CREATE INDEX IF NOT EXISTS idx_bookings_broadcast
  ON bookings (is_broadcast, status, driver_id)
  WHERE is_broadcast = true;

-- 4. RLS: chauffeurs peuvent voir les courses broadcast disponibles
DROP POLICY IF EXISTS "driver_read_broadcast" ON bookings;
CREATE POLICY "driver_read_broadcast" ON bookings
  FOR SELECT USING (
    is_broadcast = true
    AND status = 'pending'
    AND driver_id IS NULL
    AND is_driver()
  );

-- 5. RLS: chauffeur peut "prendre" une course broadcast (set driver_id)
DROP POLICY IF EXISTS "driver_claim_broadcast" ON bookings;
CREATE POLICY "driver_claim_broadcast" ON bookings
  FOR UPDATE USING (
    is_broadcast = true
    AND status = 'pending'
    AND driver_id IS NULL
    AND is_driver()
  )
  WITH CHECK (is_driver());

-- 6. Storage bucket for attestation PDFs (run in Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('attestations', 'attestations', false, 5242880, ARRAY['application/pdf'])
-- ON CONFLICT (id) DO NOTHING;
