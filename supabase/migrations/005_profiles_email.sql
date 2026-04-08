-- Migration 005 : Ajouter email dans profiles pour l'affichage admin

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Remplir l'email depuis auth.users pour les profils existants
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- Mettre à jour le trigger pour inclure l'email lors de la création
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
