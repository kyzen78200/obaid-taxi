'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

interface Booking {
  id: string
  pickup_address: string
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_address: string
  dropoff_lat: number | null
  dropoff_lng: number | null
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
  notes: string | null
  drivers?: { first_name: string; last_name: string; phone: string | null } | null
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

const CANCEL_REASONS = [
  'Changement de plans',
  'Erreur de saisie',
  'Commande en double',
  'Problème personnel',
  'Trop cher',
  'Autre',
]

function canCancel(booking: Booking): boolean {
  if (!['pending', 'confirmed'].includes(booking.status)) return false
  if (booking.status === 'pending') return true
  // confirmed : seulement si > 2h avant le départ
  const departure = new Date(booking.scheduled_at).getTime()
  const now = Date.now()
  return departure - now > 2 * 60 * 60 * 1000
}

function isTooLateToCancel(booking: Booking): boolean {
  if (booking.status !== 'confirmed') return false
  const departure = new Date(booking.scheduled_at).getTime()
  const now = Date.now()
  return departure - now <= 2 * 60 * 60 * 1000
}

export default function BookingStatusPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeadlineModal, setShowDeadlineModal] = useState(false)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0])
  const [cancelOther, setCancelOther] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    loadBooking()

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
      .select('id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, scheduled_at, trip_type, status, estimated_min, estimated_max, base_price, distance_km, duration_min, refusal_comment, cancellation_reason, notes, drivers(first_name, last_name, phone)')
      .eq('id', params.id)
      .single()

    if (error || !data) { setNotFound(true); setLoading(false); return }
    setBooking(data as any)
    setLoading(false)
  }

  async function handleCancelClick() {
    if (!booking) return
    if (isTooLateToCancel(booking)) {
      setShowDeadlineModal(true)
    } else {
      setShowCancelModal(true)
    }
  }

  async function handleConfirmCancel() {
    if (!booking) return
    setCancelling(true)
    const reason = cancelReason === 'Autre' ? cancelOther.trim() || 'Autre' : cancelReason
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .eq('id', booking.id)
      .in('status', ['pending', 'confirmed'])

    setCancelling(false)
    if (!error) {
      setShowCancelModal(false)
      setBooking(prev => prev ? { ...prev, status: 'cancelled', cancellation_reason: reason } : prev)
    }
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
  const driver = booking.drivers as any

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
          {booking.cancellation_reason && booking.status === 'cancelled' && (
            <p className="text-sm mt-2 opacity-80">Raison : {booking.cancellation_reason}</p>
          )}
        </div>

        {/* Référence */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">Référence</span>
          <span className="text-sm font-mono font-semibold text-gray-900">#{booking.id.slice(0, 8).toUpperCase()}</span>
        </div>

        {/* Chauffeur (si confirmé ou en cours) */}
        {driver && ['confirmed', 'in_progress'].includes(booking.status) && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-blue-500">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Votre chauffeur</h2>
            <p className="text-sm text-gray-800 font-medium">{driver.first_name} {driver.last_name}</p>
            {driver.phone && (
              <a href={`tel:${driver.phone}`} className="text-sm text-blue-700 hover:underline mt-1 block">
                📞 {driver.phone}
              </a>
            )}
          </div>
        )}

        {/* Trajet */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {booking.pickup_lat && booking.dropoff_lat && (
            <img
              src={`https://maps.googleapis.com/maps/api/staticmap?size=600x180&maptype=roadmap&markers=color:blue%7Clabel:A%7C${booking.pickup_lat},${booking.pickup_lng}&markers=color:green%7Clabel:B%7C${booking.dropoff_lat},${booking.dropoff_lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
              alt="Carte du trajet"
              className="w-full h-40 object-cover"
            />
          )}
          <div className="p-5 space-y-3">
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

          {booking.notes && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Notes</p>
              <p className="text-sm text-gray-700">{booking.notes}</p>
            </div>
          )}
          </div>
        </div>

        {booking.status === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700">
              Cette page se met à jour automatiquement. Vous recevrez aussi une notification par email dès la confirmation.
            </p>
          </div>
        )}

        {/* Bouton annuler */}
        {canCancel(booking) && (
          <button
            onClick={handleCancelClick}
            className="w-full border border-red-200 text-red-600 font-medium py-3 rounded-xl text-sm hover:bg-red-50 transition-colors"
          >
            Annuler la réservation
          </button>
        )}

        {/* Trop tard pour annuler en ligne */}
        {isTooLateToCancel(booking) && (
          <button
            onClick={() => setShowDeadlineModal(true)}
            className="w-full border border-gray-200 text-gray-500 font-medium py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Demander une annulation
          </button>
        )}

        {/* Refaire la même réservation */}
        {booking.status === 'completed' && (
          <Link
            href="/"
            className="block text-center bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            Refaire une réservation
          </Link>
        )}

        <Link
          href="/"
          className="block text-center text-sm text-blue-700 font-medium py-3 hover:text-blue-800"
        >
          Faire une autre réservation
        </Link>
      </div>

      {/* Modal annulation */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Annuler la réservation</h2>
            <p className="text-sm text-gray-500 mb-4">Pourquoi souhaitez-vous annuler ?</p>
            <div className="space-y-2 mb-4">
              {CANCEL_REASONS.map(reason => (
                <label key={reason} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
            {cancelReason === 'Autre' && (
              <textarea
                value={cancelOther}
                onChange={e => setCancelOther(e.target.value)}
                placeholder="Précisez..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50"
              >
                Retour
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium py-2.5 rounded-xl text-sm"
              >
                {cancelling ? 'Annulation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal délai dépassé */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Annulation impossible en ligne</h2>
            <p className="text-sm text-gray-600 mb-4">
              Le départ est dans moins de 2 heures. Pour annuler, contactez directement votre chauffeur.
            </p>
            {driver?.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="block text-center bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm mb-3 hover:bg-blue-800"
              >
                Appeler {driver.first_name} — {driver.phone}
              </a>
            )}
            <button
              onClick={() => setShowDeadlineModal(false)}
              className="w-full border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
