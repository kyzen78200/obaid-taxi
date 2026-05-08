-- ─────────────────────────────────────────────────────────────
-- Migration 014 : Correction RLS table zones
-- Problème : la policy "zones_admin_write" utilisait
--   auth.role() = 'authenticated' — n'importe quel utilisateur
--   connecté (client, chauffeur) pouvait modifier les tarifs.
-- Correction : restreindre l'écriture aux admins via is_admin().
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "zones_admin_write" ON zones;

CREATE POLICY "zones_admin_write" ON zones
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
