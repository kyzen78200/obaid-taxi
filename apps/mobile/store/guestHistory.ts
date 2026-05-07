import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Enregistrement d'une réservation invité stocké localement.
 * Sous-ensemble de Booking sans client_id (toujours null pour les invités).
 * Persiste dans AsyncStorage sous la clé 'guest-booking-history'.
 */
export interface GuestBookingRecord {
  id: string
  pickup_address: string
  dropoff_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_lat: number
  dropoff_lng: number
  scheduled_at: string
  trip_type: string
  estimated_min: number
  estimated_max: number
  distance_km: number
  duration_min: number
  status: string
  created_at: string
  guest_name: string
  guest_phone: string
  guest_email: string | null
  notes: string | null
  tariff_code: string | null
  is_conventional: boolean
}

interface GuestHistoryState {
  bookings: GuestBookingRecord[]
  addBooking: (booking: GuestBookingRecord) => void
  updateStatus: (id: string, status: string) => void
  clearHistory: () => void
}

/**
 * Store persistant pour l'historique des réservations en mode invité.
 * Utilise zustand/persist + AsyncStorage pour survivre aux redémarrages de l'app.
 * Le statut est mis à jour via Realtime dans booking/[id].tsx.
 */
export const useGuestHistoryStore = create<GuestHistoryState>()(
  persist(
    (set) => ({
      bookings: [],

      /** Ajoute une réservation en tête de liste (ordre anti-chronologique) */
      addBooking: (booking) =>
        set((state) => ({ bookings: [booking, ...state.bookings] })),

      /** Met à jour le statut d'une réservation existante (appelé depuis booking/[id].tsx via Realtime) */
      updateStatus: (id, status) =>
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === id ? { ...b, status } : b)),
        })),

      /** Efface tout l'historique local (appelé depuis profile.tsx) */
      clearHistory: () => set({ bookings: [] }),
    }),
    {
      name: 'guest-booking-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
