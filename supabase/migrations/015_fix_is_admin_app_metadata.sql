-- ─────────────────────────────────────────────────────────────
-- Migration 015 : Correction is_admin() — user_metadata → app_metadata
-- Problème : is_admin() lisait user_metadata, modifiable par
--   l'utilisateur via supabase.auth.updateUser(). Un client
--   pouvait s'auto-promouvoir admin et bypasser toutes les RLS.
-- Correction : lire app_metadata (géré côté serveur uniquement).
--
-- ⚠️  ACTION MANUELLE REQUISE après cette migration :
--   Mettre à jour le compte admin dans le dashboard Supabase :
--   Authentication > Users > kyzen78200@gmail.com
--   > Edit > app_metadata : { "role": "admin" }
--   OU via SQL :
--   UPDATE auth.users
--     SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--     WHERE email = 'kyzen78200@gmail.com';
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin';
$$ LANGUAGE sql SECURITY DEFINER;
