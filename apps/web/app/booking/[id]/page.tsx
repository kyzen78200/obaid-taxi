'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

interface Booking {
  id: string
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  trip_type: string
  status: string
  estimated_min: number
  estimated_max: number
  base_price: number | null
  distance_km: number | null
  duration_min: number | null
  refusal_comment: string | null
  cancellation_reason: string | null
}

const STATUS_DESCRIPTIONS: Record<string, { title: string; description: string; color: string }> = {
  pending: {
    title: 'En attente de confirmation',
    description: 'Votre demande a été reçue. Le gestionnaire va confirmer votre réservation très prochainement.',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  },
  confirmed: {
    title: 'Réservation confirmée !',
    description: 'Votre course est confirmée. Votre chauffeur sera présent à l\'heure indiquée.',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  in_progress: {
    title: 'Course en cours',
    description: 'Votre chauffeur est en route.',
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  },
  completed: {
    title: 'Course effectuée',
    description: 'Merci d\'avoir choisi O Taxi. À bientôt !',
    color: 'text-green-700 bg-green-50 border-green-200',
  },
  refused: {
    title: 'Réservation refusée',
    description: 'Votre demande n\'a pas pu être acceptée.',
    color: 'text-red-700 bg-red-50 border-red-200',
  },
  cancelled: {
    title: 'Course annulée',
    description: 'Cette course a été annulée.',
    color: 'text-gray-700 bg-gray-50 border-gray-200',
  },
  no_show: {
    title: 'No-show',
    description: 'Le chauffeur ne vous a pas trouvé à l\'adresse indiquée.',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
  },
  cancellation_requested: {
    title: 'Annulation en cours',
    description: 'Votre demande d\'annulation est en cours de traitement.',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
  },
}

export default function BookingStatusPage() {
  const params = useParams<{ id: string }>()
  const supabase = createClient()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    loadBooking()

    // Realtime subscription
    const channel = supabase
      .channel(`booking-${params.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${params.id}`,
      }, (payload) => {
        setBooking(prev => prev ? { ...prev, ...payload.new } : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [params.id])

  async function loadBooking() {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, pickup_address, dropoff_address, scheduled_at, trip_type, status, estimated_min, estimated_max, base_price, distance_km, duration_min, refusal_comment, cancellation_reason')
      .eq('id', params.id)
      .single()

    if (error || !data) { setNotFound(true); setLoading(false); return }
    setBooking(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  if (notFound || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Réservation introuvable.</p>
          <Link href="/" className="text-blue-700 font-medium hover:underline">Retour à l'accueil</Link>
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_DESCRIPTIONS[booking.status] ?? {
    title: booking.status,
    description: '',
    color: 'text-gray-700 bg-gray-50 border-gray-200',
  }

  const scheduledDate = new Date(booking.scheduled_at)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-blue-700 text-sm font-medium hover:text-blue-800">← Nouvelle réservation</Link>
        <Link href="/history" className="text-gray-500 text-sm hover:text-gray-700">Mes réservations</Link>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Statut */}
        <div className={`rounded-2xl border p-5 ${statusInfo.color}`}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-base font-semibold">{statusInfo.title}</h1>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-sm leading-relaxed opacity-80">{statusInfo.description}</p>
          {booking.refusal_comment && (
            <p className="text-sm mt-2 font-medium">Motif : {booking.refusal_comment}</p>
          )}
        </div>

        {/* Référence */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">Référence</span>
          <span className="text-sm font-mono font-semibold text-gray-900">#{booking.id.slice(0, 8).toUpperCase()}</span>
        </div>

        {/* Trajet */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Votre trajet</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Départ</p>
                <p className="text-gray-900">{booking.pickup_address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Arrivée</p>
                <p className="text-gray-900">{booking.dropoff_address}</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Date et heure</p>
              <p className="text-gray-900">
                {scheduledDate.toLocaleString('fr-FR', {
                  weekday: 'short', day: '2-digit', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Type</p>
              <p className="text-gray-900">{booking.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'}</p>
            </div>
            {booking.distance_km != null && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Distance</p>
                <p className="text-gray-900">{booking.distance_km} km</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Estimation</p>
              <p className="text-gray-900 font-semibold">
                {booking.base_price != null
                  ? `${booking.base_price.toFixed(2)} €`
                  : `${booking.estimated_min}–${booking.estimated_max} €`}
              </p>
            </div>
          </div>
        </div>

        {booking.status === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700">
              Cette page se met à jour automatiquement. Vous recevrez aussi une notification par email dès la confirmation.
            </p>
          </div>
        )}

        <Link
          href="/"
          className="block text-center text-sm text-blue-700 font-medium py-3 hover:text-blue-800"
        >
          Faire une autre réservation
        </Link>
      </div>
    </div>
  )
}
