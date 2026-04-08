-- Migration 006 : Chauffeurs + raison d'annulation + commentaire de refus

-- 1. Nouveaux statuts dans l'enum booking_status
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancellation_requested';

-- 2. Nouvelles colonnes sur bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS refusal_comment     text,
  ADD COLUMN IF NOT EXISTS driver_id           uuid;

-- 3. Table chauffeurs
CREATE TABLE IF NOT EXISTS drivers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name  text        NOT NULL,
  last_name   text        NOT NULL,
  phone       text,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'revoked')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. FK optionnelle driver_id → drivers
ALTER TABLE bookings
  ADD CONSTRAINT bookings_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;

-- 5. RLS sur drivers
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Admin voit tout
CREATE POLICY "admin_all_drivers" ON drivers
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Chauffeur voit son propre profil
CREATE POLICY "driver_read_own" ON drivers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 6. Fonction helper is_driver()
CREATE OR REPLACE FUNCTION is_driver()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM drivers WHERE user_id = auth.uid() AND status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 7. Autoriser les chauffeurs à lire les réservations qui leur sont assignées
CREATE POLICY "driver_read_assigned_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid() AND status = 'approved'));

-- 8. Autoriser les chauffeurs à mettre à jour le statut de leurs réservations assignées
CREATE POLICY "driver_update_assigned_bookings" ON bookings
  FOR UPDATE TO authenticated
  USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid() AND status = 'approved'))
  WITH CHECK (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid() AND status = 'approved'));
