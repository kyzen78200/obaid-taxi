import { create } from 'zustand'
import type { BookingFormData, PriceEstimate } from '@obaid-taxi/shared'

interface BookingState {
  formData: Partial<BookingFormData>
  estimate: PriceEstimate | null
  routePolyline: string | null
  setFormData: (data: Partial<BookingFormData>) => void
  setEstimate: (estimate: PriceEstimate | null) => void
  setRoutePolyline: (polyline: string | null) => void
  reset: () => void
}

export const useBookingStore = create<BookingState>((set) => ({
  formData: {},
  estimate: null,
  routePolyline: null,

  setFormData: (data) =>
    set((state) => ({ formData: { ...state.formData, ...data } })),

  setEstimate: (estimate) => set({ estimate }),

  setRoutePolyline: (polyline) => set({ routePolyline: polyline }),

  reset: () => set({ formData: {}, estimate: null, routePolyline: null }),
}))
