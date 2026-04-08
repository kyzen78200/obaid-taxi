// ─── Enums ───────────────────────────────────────────────────────────────────

export type TripType = 'one_way' | 'round_trip'

export type TariffCode = 'A' | 'B' | 'C' | 'D'

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'refused'
  | 'cancelled'
  | 'no_show'
  | 'cancellation_requested'

export type FarePackageType = 'station' | 'airport'

export type LoyaltyTransactionType = 'earned' | 'redeemed'

// ─── Database Models ──────────────────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  push_token: string | null
  loyalty_points: number
  created_at: string
}

export interface Booking {
  id: string
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
  is_conventional: boolean
  distance_km: number
  duration_min: number
  tariff_code: TariffCode
  base_price: number
  estimated_min: number
  estimated_max: number
  forfait_id: string | null
  notes: string | null
  status: BookingStatus
  points_credited: number | null
  cancellation_reason: string | null
  refusal_comment: string | null
  driver_id: string | null
  created_at: string
}

export interface Driver {
  id: string
  user_id: string | null
  first_name: string
  last_name: string
  phone: string | null
  status: 'pending' | 'approved' | 'revoked'
  created_at: string
}

export interface BookingStatusHistory {
  id: string
  booking_id: string
  status: BookingStatus
  changed_by: string | null
  changed_at: string
  comment: string | null
}

export interface FarePackage {
  id: string
  name: string
  type: FarePackageType
  price: number
  active: boolean
  zone_polygon: GeoJSON | null
  lat: number | null
  lng: number | null
}

export interface LoyaltyTransaction {
  id: string
  client_id: string
  booking_id: string
  points: number
  type: LoyaltyTransactionType
  created_at: string
}

// ─── GeoJSON minimal ──────────────────────────────────────────────────────────

export interface GeoJSON {
  type: string
  coordinates: unknown
}

// ─── API / UI Types ───────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number
  lng: number
}

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
  guest_name?: string
  guest_phone?: string
  guest_email?: string
}

export interface PriceEstimate {
  tariff_code: TariffCode
  base_price: number
  estimated_min: number
  estimated_max: number
  distance_km: number
  duration_min: number
  is_forfait: boolean
  forfait_name?: string
}

export interface RouteInfo {
  distance_km: number
  duration_min: number
}
