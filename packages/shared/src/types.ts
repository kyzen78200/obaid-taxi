// ─── Enums ───────────────────────────────────────────────────────────────────

/** Type de course : aller simple ou aller-retour */
export type TripType = 'one_way' | 'round_trip'

/**
 * Code tarifaire kilométrique appliqué à la course.
 * A = Aller-retour Jour (0,99€/km), B = Aller-retour Nuit (1,49€/km)
 * C = Aller simple Jour (1,98€/km), D = Aller simple Nuit (2,97€/km)
 */
export type TariffCode = 'A' | 'B' | 'C' | 'D'

/**
 * Cycle de vie d'une réservation, géré manuellement par le gestionnaire.
 * Les transitions sont : pending → confirmed/refused, confirmed → in_progress → completed/no_show,
 * pending/confirmed → cancellation_requested → cancelled.
 */
export type BookingStatus =
  | 'pending'                 // En attente de validation gestionnaire
  | 'confirmed'               // Validée par le gestionnaire
  | 'in_progress'             // Course en cours
  | 'completed'               // Effectuée
  | 'refused'                 // Refusée par le gestionnaire
  | 'cancelled'               // Annulée par le client
  | 'no_show'                 // Client absent au point de départ
  | 'cancellation_requested'  // Demande d'annulation en attente de validation

/** Type de forfait : gare (station) ou aéroport */
export type FarePackageType = 'station' | 'airport'

/** Mouvement de points fidélité : gain après une course ou utilisation en réduction */
export type LoyaltyTransactionType = 'earned' | 'redeemed'

// ─── Database Models ──────────────────────────────────────────────────────────

/** Profil client — extension de auth.users, créé automatiquement via trigger Supabase */
export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  /** Token Expo Push enregistré lors de la connexion sur mobile */
  push_token: string | null
  loyalty_points: number
  created_at: string
}

/**
 * Réservation de course — entité centrale de l'application.
 * Peut être créée par un utilisateur connecté (client_id) ou en mode invité (guest_*).
 */
export interface Booking {
  id: string
  /** null si réservation invité */
  client_id: string | null
  guest_name: string | null
  guest_phone: string | null
  guest_email: string | null
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  scheduled_at: string
  trip_type: TripType
  /** true si course médicale CPAM (transport conventionné) */
  is_conventional: boolean
  distance_km: number
  duration_min: number
  tariff_code: TariffCode
  /** Prix de base calculé (avant marge fourchette) */
  base_price: number
  /** Borne basse de l'estimation affichée au client */
  estimated_min: number
  /** Borne haute de l'estimation affichée au client (base_price × 1,35) */
  estimated_max: number
  /** null si calcul kilométrique, sinon ID du forfait gare/aéroport appliqué */
  forfait_id: string | null
  notes: string | null
  status: BookingStatus
  points_credited: number | null
  cancellation_reason: string | null
  refusal_comment: string | null
  driver_id: string | null
  created_at: string
}

/** Compte chauffeur — distinct de Profile, géré dans la table drivers */
export interface Driver {
  id: string
  /** Lié à auth.users — null si le compte Supabase n'a pas encore été créé */
  user_id: string | null
  first_name: string
  last_name: string
  phone: string | null
  /** pending = en attente de validation, approved = actif, revoked = suspendu */
  status: 'pending' | 'approved' | 'revoked'
  created_at: string
}

/** Historique des changements de statut d'une réservation (audit trail) */
export interface BookingStatusHistory {
  id: string
  booking_id: string
  status: BookingStatus
  /** ID de l'utilisateur ayant effectué le changement, null si automatique */
  changed_by: string | null
  changed_at: string
  comment: string | null
}

/**
 * Forfait tarifaire fixe pour destinations connues (gares, aéroports).
 * Si actif et zone_polygon défini, la correspondance est détectée via isPointInPolygon().
 */
export interface FarePackage {
  id: string
  name: string
  type: FarePackageType
  price: number
  active: boolean
  /** Polygone GeoJSON délimitant la zone d'application du forfait */
  zone_polygon: GeoJSON | null
  /** Coordonnées de la destination (point de référence pour l'affichage) */
  lat: number | null
  lng: number | null
}

/** Mouvement de points fidélité associé à une course */
export interface LoyaltyTransaction {
  id: string
  client_id: string
  booking_id: string
  points: number
  type: LoyaltyTransactionType
  created_at: string
}

// ─── GeoJSON minimal ──────────────────────────────────────────────────────────

/**
 * Sous-ensemble minimal de GeoJSON utilisé pour les polygones de zones forfait.
 * En pratique, coordinates est toujours un tableau de [lng, lat] pour un Polygon.
 */
export interface GeoJSON {
  type: string
  coordinates: unknown
}

// ─── API / UI Types ───────────────────────────────────────────────────────────

/** Paire de coordonnées géographiques */
export interface Coordinates {
  lat: number
  lng: number
}

/** Données du formulaire de réservation, alimentées progressivement dans le store booking */
export interface BookingFormData {
  pickup_address: string
  pickup_coords: Coordinates
  dropoff_address: string
  dropoff_coords: Coordinates
  scheduled_at: Date
  trip_type: TripType
  is_conventional: boolean
  forfait_id?: string
  notes?: string
  /** Champs invité — renseignés sur l'écran confirm.tsx si l'utilisateur n'est pas connecté */
  guest_name?: string
  guest_phone?: string
  guest_email?: string
}

/** Résultat du calcul tarifaire retourné par calculateFare() */
export interface PriceEstimate {
  tariff_code: TariffCode
  base_price: number
  estimated_min: number
  estimated_max: number
  distance_km: number
  duration_min: number
  /** true si un forfait gare/aéroport a été appliqué (prix fixe, sans marge) */
  is_forfait: boolean
  forfait_name?: string
}

/** Informations de trajet retournées par getRouteInfo() via Google Directions API */
export interface RouteInfo {
  distance_km: number
  duration_min: number
}
