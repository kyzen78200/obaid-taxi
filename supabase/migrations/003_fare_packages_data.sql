-- Ajout des coordonnées GPS sur fare_packages
ALTER TABLE fare_packages
  ADD COLUMN IF NOT EXISTS lat float,
  ADD COLUMN IF NOT EXISTS lng float;

-- ─── Gares parisiennes ────────────────────────────────────────────────────────
-- Prix indicatifs depuis la zone Mantes-la-Jolie — à ajuster via l'admin
INSERT INTO fare_packages (name, type, price, active, lat, lng) VALUES
  ('Gare Saint-Lazare',   'station', 85.00, true,  48.8763,  2.3243),
  ('Gare du Nord',        'station', 85.00, true,  48.8809,  2.3553),
  ('Gare de l''Est',      'station', 85.00, true,  48.8769,  2.3591),
  ('Gare Montparnasse',   'station', 90.00, true,  48.8408,  2.3212),
  ('Gare d''Austerlitz',  'station', 85.00, true,  48.8434,  2.3655),
  ('Gare de Lyon',        'station', 85.00, true,  48.8448,  2.3734),
  ('Gare de Bercy',       'station', 80.00, true,  48.8403,  2.3798)
ON CONFLICT DO NOTHING;

-- ─── Aéroports ────────────────────────────────────────────────────────────────
INSERT INTO fare_packages (name, type, price, active, lat, lng) VALUES
  ('Aéroport CDG',      'airport', 100.00, true,  49.0097,  2.5479),
  ('Aéroport Orly',     'airport', 110.00, true,  48.7233,  2.3795),
  ('Aéroport Beauvais', 'airport',  75.00, true,  49.4544,  2.1128)
ON CONFLICT DO NOTHING;
