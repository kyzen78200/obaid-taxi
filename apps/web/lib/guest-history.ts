// Historique des réservations invité (stocké en localStorage)

export interface GuestBookingRecord {
  id: string
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  status: string
  estimated_min: number
  estimated_max: number
  created_at: string
}

const KEY = 'otaxi-guest-history'

export function saveGuestBooking(booking: GuestBookingRecord) {
  const existing = getGuestHistory()
  const updated = [booking, ...existing.filter(b => b.id !== booking.id)]
  localStorage.setItem(KEY, JSON.stringify(updated))
}

export function getGuestHistory(): GuestBookingRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
