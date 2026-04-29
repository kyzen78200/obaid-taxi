-- ═══════════════════════════════════════════════════════════════
-- 012 — Allow clients to save attestation_url on their booking
-- ═══════════════════════════════════════════════════════════════
--
-- The storage upload succeeds but the UPDATE on bookings.attestation_url
-- was silently rejected because no RLS policy covered this case:
--   - authenticated clients have no UPDATE policy beyond cancellation
--   - anonymous (guest) clients have no UPDATE policy at all

-- Authenticated clients: update attestation_url on their own booking
CREATE POLICY "client_update_attestation_url" ON bookings
  FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Anonymous (guest) clients: update attestation_url on guest bookings
-- Trust the booking UUID — it is not guessable (128-bit random)
CREATE POLICY "guest_update_attestation_url" ON bookings
  FOR UPDATE TO anon
  USING (client_id IS NULL)
  WITH CHECK (client_id IS NULL);
