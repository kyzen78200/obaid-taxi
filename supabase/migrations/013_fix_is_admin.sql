-- ═══════════════════════════════════════════════════════════════
-- 013 — Fix is_admin() : lire depuis profiles, pas le JWT
-- ═══════════════════════════════════════════════════════════════
--
-- L'ancienne version lisait auth.jwt() ->> 'role' ou user_metadata.role.
-- Ces champs ne sont jamais remplis automatiquement depuis profiles.role.
-- Résultat : is_admin() retournait false pour tous les admins, bloquant
-- toutes les policies RLS basées sur cette fonction (drivers, bookings...).
--
-- La nouvelle version interroge directement la table profiles.
-- SECURITY DEFINER permet de bypasser la RLS sur profiles.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;
