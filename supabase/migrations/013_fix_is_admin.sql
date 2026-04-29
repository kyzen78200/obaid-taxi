-- ═══════════════════════════════════════════════════════════════
-- 013 — Définir le rôle admin dans les métadonnées auth
-- ═══════════════════════════════════════════════════════════════
--
-- is_admin() lit auth.jwt() -> user_metadata -> role (approche JWT, plus
-- performante). Pour qu'un compte soit reconnu admin, il faut injecter
-- le claim dans auth.users.raw_user_meta_data.
--
-- À exécuter pour chaque nouveau compte admin :
--   UPDATE auth.users
--   SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
--   WHERE email = 'email_admin@exemple.fr';

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'kyzen78200@gmail.com';
