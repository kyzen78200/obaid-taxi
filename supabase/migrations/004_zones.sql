-- ─────────────────────────────────────────────────────────────
-- Migration 004 : Zones tarifaires (rayon autour d'un centre)
-- ─────────────────────────────────────────────────────────────

-- 1. Table zones
CREATE TABLE IF NOT EXISTS zones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  center_lat float NOT NULL,
  center_lng float NOT NULL,
  radius_km  float NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
-- Lecture publique (utilisée par l'app mobile)
CREATE POLICY "zones_public_read" ON zones
  FOR SELECT USING (true);
-- Écriture admin uniquement
CREATE POLICY "zones_admin_write" ON zones
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. Modifier fare_packages : ajouter zone_id
ALTER TABLE fare_packages ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES zones(id) ON DELETE SET NULL;

-- Supprimer l'ancienne colonne zone_polygon si elle existe
ALTER TABLE fare_packages DROP COLUMN IF EXISTS zone_polygon;

-- 3. Insérer la zone Mantes-la-Jolie par défaut
-- Centre approximatif de la zone (Mantes-la-Jolie)
INSERT INTO zones (id, name, center_lat, center_lng, radius_km, active)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Mantes-la-Jolie',
  48.990,
  1.717,
  8.0,
  true
);

-- 4. Rattacher les fare_packages existants à la zone Mantes
UPDATE fare_packages
SET zone_id = 'a1b2c3d4-0000-0000-0000-000000000001'
WHERE zone_id IS NULL;
