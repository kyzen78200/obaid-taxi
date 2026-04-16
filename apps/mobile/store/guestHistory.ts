import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

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

export const useGuestHistoryStore = create<GuestHistoryState>()(
  persist(
    (set) => ({
      bookings: [],

      addBooking: (booking) =>
        set((state) => ({ bookings: [booking, ...state.bookings] })),

      updateStatus: (id, status) =>
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === id ? { ...b, status } : b)),
        })),

      clearHistory: () => set({ bookings: [] }),
    }),
    {
      name: 'guest-booking-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
