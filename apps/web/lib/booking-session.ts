// Stockage temporaire du flow de réservation (entre les pages /)→/estimate→/confirm)

export interface BookingSession {
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  scheduled_at: string
  trip_type: 'one_way' | 'round_trip'
  is_conventional: boolean
  distance_km: number
  duration_min: number
  tariff_code: string
  base_price: number
  estimated_min: number
  estimated_max: number
  // Forfait
  forfait_id?: string | null
  forfait_name?: string | null
}

const KEY = 'otaxi-booking-session'

export function saveBookingSession(data: BookingSession) {
  sessionStorage.setItem(KEY, JSON.stringify(data))
}

export function loadBookingSession(): BookingSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearBookingSession() {
  sessionStorage.removeItem(KEY)
}
