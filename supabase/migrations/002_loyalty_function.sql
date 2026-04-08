-- Fonction pour créditer les points fidélité de façon atomique
CREATE OR REPLACE FUNCTION credit_loyalty_points(
  p_client_id uuid,
  p_booking_id uuid,
  p_points integer
) RETURNS void AS $$
BEGIN
  -- Insérer la transaction fidélité
  INSERT INTO loyalty_transactions (client_id, booking_id, points, type)
  VALUES (p_client_id, p_booking_id, p_points, 'earned');

  -- Mettre à jour le solde du profil
  UPDATE profiles
  SET loyalty_points = loyalty_points + p_points
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
