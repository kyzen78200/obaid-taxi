-- ============================================================
-- Obaid Taxi — Migration initiale
-- ============================================================

-- Extension pour les UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE trip_type AS ENUM ('one_way', 'round_trip');
CREATE TYPE tariff_code AS ENUM ('A', 'B', 'C', 'D');
CREATE TYPE booking_status AS ENUM (
  'pending',
  'confirmed',
  'completed',
  'refused',
  'cancelled',
  'no_show'
);
CREATE TYPE fare_package_type AS ENUM ('station', 'airport');
CREATE TYPE loyalty_transaction_type AS ENUM ('earned', 'redeemed');

-- ─── Profiles ────────────────────────────────────────────────────────────────
-- Extension de auth.users (créé automatiquement par Supabase Auth)

CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  phone         text,
  push_token    text,
  loyalty_points integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Trigger : créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ─── Fare Packages (Forfaits gare/aéroport) ──────────────────────────────────

CREATE TABLE fare_packages (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,
  type          fare_package_type NOT NULL,
  price         numeric(8,2) NOT NULL CHECK (price > 0),
  active        boolean NOT NULL DEFAULT true,
  zone_polygon  jsonb,  -- GeoJSON Polygon définissant la zone Mantes-la-Jolie
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Données initiales : forfaits exemple pour Mantes-la-Jolie
INSERT INTO fare_packages (name, type, price, active) VALUES
  ('Gare de Mantes-la-Jolie', 'station', 15.00, true),
  ('Gare de Mantes-la-Ville', 'station', 16.00, true),
  ('Aéroport Charles de Gaulle (CDG)', 'airport', 95.00, true),
  ('Aéroport d''Orly (ORY)', 'airport', 85.00, true),
  ('Aéroport de Beauvais (BVA)', 'airport', 80.00, true);

-- ─── Bookings (Réservations) ──────────────────────────────────────────────────

CREATE TABLE bookings (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Client (null si invité)
  client_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Informations invité
  guest_name        text,
  guest_phone       text,
  guest_email       text,

  -- Adresses
  pickup_address    text NOT NULL,
  pickup_lat        double precision NOT NULL,
  pickup_lng        double precision NOT NULL,
  dropoff_address   text NOT NULL,
  dropoff_lat       double precision NOT NULL,
  dropoff_lng       double precision NOT NULL,

  -- Date/heure
  scheduled_at      timestamptz NOT NULL,

  -- Type de course
  trip_type         trip_type NOT NULL DEFAULT 'one_way',
  is_conventional   boolean NOT NULL DEFAULT false,

  -- Calcul tarifaire
  distance_km       double precision NOT NULL,
  duration_min      integer NOT NULL,
  tariff_code       tariff_code NOT NULL,
  base_price        numeric(8,2) NOT NULL,
  estimated_min     numeric(8,2) NOT NULL,
  estimated_max     numeric(8,2) NOT NULL,

  -- Forfait gare/aéroport (optionnel)
  forfait_id        uuid REFERENCES fare_packages(id) ON DELETE SET NULL,

  -- Notes chauffeur
  notes             text,

  -- Statut
  status            booking_status NOT NULL DEFAULT 'pending',

  -- Points fidélité crédités (renseigné lors du passage en "completed")
  points_credited   integer,

  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Contrainte : soit client_id, soit les infos invité
  CONSTRAINT booking_has_client_or_guest CHECK (
    client_id IS NOT NULL
    OR (guest_name IS NOT NULL AND guest_phone IS NOT NULL)
  )
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_scheduled_at ON bookings(scheduled_at);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- ─── Booking Status History ───────────────────────────────────────────────────

CREATE TABLE booking_status_history (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status        booking_status NOT NULL,
  changed_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  comment       text
);

CREATE INDEX idx_status_history_booking ON booking_status_history(booking_id);

-- Trigger : enregistrer automatiquement l'historique à chaque changement de statut
CREATE OR REPLACE FUNCTION log_booking_status_change()
RETURNS trigger AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO booking_status_history (booking_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_status_changed
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE PROCEDURE log_booking_status_change();

-- ─── Loyalty Transactions ─────────────────────────────────────────────────────

CREATE TABLE loyalty_transactions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id    uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  points        integer NOT NULL CHECK (points != 0),
  type          loyalty_transaction_type NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_client ON loyalty_transactions(client_id);

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────

-- Activer RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fare_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Helper : vérifie si l'utilisateur courant est admin
-- L'admin a le rôle 'admin' dans ses user_metadata
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT (auth.jwt() ->> 'role')::text = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin';
$$ LANGUAGE sql SECURITY DEFINER;

-- ── profiles ──────────────────────────────────────────────────────────────────
CREATE POLICY "profiles: lecture propre compte"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "profiles: modification propre compte"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── bookings ──────────────────────────────────────────────────────────────────
CREATE POLICY "bookings: lecture client"
  ON bookings FOR SELECT
  USING (client_id = auth.uid() OR is_admin());

CREATE POLICY "bookings: création (client ou invité)"
  ON bookings FOR INSERT
  WITH CHECK (
    -- Client connecté crée pour lui-même
    (auth.uid() IS NOT NULL AND client_id = auth.uid())
    -- Invité (pas de client_id)
    OR (auth.uid() IS NULL AND client_id IS NULL)
    -- Admin peut créer pour n'importe qui
    OR is_admin()
  );

CREATE POLICY "bookings: annulation par client"
  ON bookings FOR UPDATE
  USING (client_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');

CREATE POLICY "bookings: toutes modifications par admin"
  ON bookings FOR UPDATE
  USING (is_admin());

-- ── booking_status_history ────────────────────────────────────────────────────
CREATE POLICY "history: lecture client sur ses courses"
  ON booking_status_history FOR SELECT
  USING (
    booking_id IN (SELECT id FROM bookings WHERE client_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "history: écriture admin uniquement"
  ON booking_status_history FOR INSERT
  WITH CHECK (is_admin());

-- ── fare_packages ─────────────────────────────────────────────────────────────
CREATE POLICY "fare_packages: lecture publique"
  ON fare_packages FOR SELECT
  USING (true);

CREATE POLICY "fare_packages: écriture admin"
  ON fare_packages FOR ALL
  USING (is_admin());

-- ── loyalty_transactions ──────────────────────────────────────────────────────
CREATE POLICY "loyalty: lecture client"
  ON loyalty_transactions FOR SELECT
  USING (client_id = auth.uid() OR is_admin());

CREATE POLICY "loyalty: écriture admin/edge function"
  ON loyalty_transactions FOR INSERT
  WITH CHECK (is_admin());
