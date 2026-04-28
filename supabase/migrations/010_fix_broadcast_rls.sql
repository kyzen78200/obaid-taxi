-- ═══════════════════════════════════════════════════════════════
-- 010 — Fix broadcast RLS: accept confirmed + pending status
-- ═══════════════════════════════════════════════════════════════
--
-- Problem: when admin confirms a booking (status='confirmed') then
-- broadcasts it (is_broadcast=true), drivers could not see it because
-- the previous policies only allowed status='pending'.
--
-- Fix: accept both 'pending' and 'confirmed' for broadcast visibility
-- and claiming, since a confirmed broadcast simply means the admin
-- approved it but it still needs a driver.

-- 4. RLS: chauffeurs peuvent voir les courses broadcast disponibles
DROP POLICY IF EXISTS "driver_read_broadcast" ON bookings;
CREATE POLICY "driver_read_broadcast" ON bookings
  FOR SELECT USING (
    is_broadcast = true
    AND status IN ('pending', 'confirmed')
    AND driver_id IS NULL
    AND is_driver()
  );

-- 5. RLS: chauffeur peut "prendre" une course broadcast (set driver_id)
DROP POLICY IF EXISTS "driver_claim_broadcast" ON bookings;
CREATE POLICY "driver_claim_broadcast" ON bookings
  FOR UPDATE USING (
    is_broadcast = true
    AND status IN ('pending', 'confirmed')
    AND driver_id IS NULL
    AND is_driver()
  )
  WITH CHECK (is_driver());
