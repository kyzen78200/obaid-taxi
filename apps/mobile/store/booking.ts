import { create } from 'zustand'
import type { BookingFormData, PriceEstimate } from '@obaid-taxi/shared'

/**
 * Store de réservation en cours — alimente le tunnel index → estimate → confirm.
 * Réinitialisé via reset() après confirmation pour préparer la prochaine réservation.
 */
interface BookingState {
  /** Données du formulaire, construites progressivement entre index.tsx et confirm.tsx */
  formData: Partial<BookingFormData>
  /** Résultat du dernier calcul tarifaire (calculateFare), null avant le premier calcul */
  estimate: PriceEstimate | null
  /** Polyline encodée Google (overview_polyline) pour l'affichage du tracé sur la carte */
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

  /** Fusionne les nouvelles données avec les données existantes (ne réinitialise pas le reste) */
  setFormData: (data) =>
    set((state) => ({ formData: { ...state.formData, ...data } })),

  /** Stocke l'estimation tarifaire calculée pour l'afficher sur estimate.tsx */
  setEstimate: (estimate) => set({ estimate }),

  /** Stocke la polyline encodée retournée par getRouteInfo() pour le tracé carte */
  setRoutePolyline: (polyline) => set({ routePolyline: polyline }),

  /** Remet le store à zéro après confirmation d'une réservation */
  reset: () => set({ formData: {}, estimate: null, routePolyline: null }),
}))
