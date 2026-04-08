'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

interface Booking {
  id: string
  guest_name: string | null
  guest_phone: string | null
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  base_price: number | null
  estimated_min: number | null
  estimated_max: number | null
  status: string
  notes: string | null
  distance_km: number | null
  duration_min: number | null
  trip_type: string
  is_conventional: boolean
  driver_id: string | null
}

export default function DriverBookingDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [driverRecord, setDriverRecord] = useState<{ id: string; first_name: string; last_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/driver-login'); return }

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, first_name, last_name')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single()

    if (!driver) { router.push('/driver-login'); return }
    setDriverRecord(driver)

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .eq('driver_id', driver.id)
      .single()

    if (error || !data) {
      router.push('/driver')
      return
    }

    setBooking(data)
    setLoading(false)
  }

  function showNotif(message: string, type: 'success' | 'error') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3500)
  }

  async function updateStatus(newStatus: string) {
    if (!booking || !driverRecord) return
    setSaving(true)
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', booking.id)

    if (error) {
      showNotif('Erreur lors de la mise à jour', 'error')
    } else {
      await supabase.from('booking_status_history').insert({
        booking_id: booking.id,
        status: newStatus,
        changed_by: `${driverRecord.first_name} ${driverRecord.last_name}`,
      })
      setBooking(prev => prev ? { ...prev, status: newStatus } : prev)
      showNotif(
        newStatus === 'in_progress' ? '🚗 Vous êtes en route !' :
        newStatus === 'completed' ? '✅ Course effectuée' :
        newStatus === 'no_show' ? 'No-show enregistré' :
        newStatus === 'cancellation_requested' ? 'Demande d\'annulation envoyée à l\'admin' :
        'Statut mis à jour',
        'success'
      )

      // Trigger admin notifications + client push
      fetch('/api/notify/driver-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, newStatus }),
      }).catch(() => {})
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  if (!booking) return null

  const isActive = ['confirmed', 'in_progress'].includes(booking.status)

  return (
    <div>
      {notification && (
        <div className={`fixed top-20 left-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-center ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {notification.message}
        </div>
      )}

      {/* Sub-header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
        <Link href="/driver" className="text-blue-700 hover:text-blue-900 text-sm font-medium transition-colors">
          ← Mes courses
        </Link>
        <StatusBadge status={booking.status} />
      </div>

      <main className="max-w-2xl mx-auto p-5 space-y-4">

        {/* Trajet */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Trajet</h2>

          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-lg mt-0.5">📍</span>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Départ</p>
                <p className="text-sm text-gray-900 font-medium">{booking.pickup_address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-lg mt-0.5">🏁</span>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Arrivée</p>
                <p className="text-sm text-gray-900 font-medium">{booking.dropoff_address}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 text-sm">
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Date et heure</p>
              <p className="text-gray-900 font-medium">
                {new Date(booking.scheduled_at).toLocaleString('fr-FR', {
                  weekday: 'long', day: '2-digit', month: 'long',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Type</p>
              <p className="text-gray-900">{booking.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'}</p>
            </div>
            {booking.distance_km != null && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Distance</p>
                <p className="text-gray-900">{booking.distance_km} km</p>
              </div>
            )}
            {booking.duration_min != null && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Durée estimée</p>
                <p className="text-gray-900">{booking.duration_min} min</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Montant</p>
              <p className="text-gray-900 font-semibold">
                {booking.base_price != null
                  ? `${booking.base_price.toFixed(2)} €`
                  : booking.estimated_min != null
                  ? `~${booking.estimated_min}–${booking.estimated_max} €`
                  : '—'}
              </p>
            </div>
            {booking.is_conventional && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Conventionné</p>
                <p className="text-gray-900">Oui</p>
              </div>
            )}
          </div>
        </div>

        {/* Client */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Client</h2>
          <div className="flex gap-4 text-sm">
            <div className="flex gap-2 items-center">
              <span>👤</span>
              <span className="text-gray-900">{booking.guest_name ?? 'Client enregistré'}</span>
            </div>
            {booking.guest_phone && (
              <a href={`tel:${booking.guest_phone}`} className="flex gap-2 items-center text-blue-700 hover:underline font-medium">
                <span>📞</span>
                <span>{booking.guest_phone}</span>
              </a>
            )}
          </div>
        </div>

        {/* Attestation PDF */}
        {(booking as any).attestation_url && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div className="flex-1">
              <p className="text-xs font-medium text-purple-700 mb-1">Attestation conventionnée</p>
              <a
                href={(booking as any).attestation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-800 font-semibold hover:underline"
              >
                Télécharger l'attestation PDF
              </a>
            </div>
          </div>
        )}

        {/* Notes */}
        {booking.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-medium text-amber-700 mb-1">Notes pour le chauffeur</p>
            <p className="text-sm text-amber-900">{booking.notes}</p>
          </div>
        )}

        {/* Actions chauffeur */}
        {isActive && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              {booking.status === 'confirmed' && (
                <button
                  onClick={() => updateStatus('in_progress')}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm"
                >
                  🚗 Je suis en route
                </button>
              )}
              {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm"
                >
                  ✅ Course effectuée
                </button>
              )}
              {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                <button
                  onClick={() => updateStatus('no_show')}
                  disabled={saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm"
                >
                  👻 Client non présent (no-show)
                </button>
              )}
              {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                <button
                  onClick={() => {
                    if (confirm('Envoyer une demande d\'annulation à l\'admin ?')) {
                      updateStatus('cancellation_requested')
                    }
                  }}
                  disabled={saving}
                  className="w-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors text-sm"
                >
                  ⚠️ Demander l'annulation à l'admin
                </button>
              )}
            </div>
          </div>
        )}

        {booking.status === 'cancellation_requested' && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-800 font-medium">⏳ Demande d'annulation en attente de décision admin</p>
          </div>
        )}

        {['completed', 'cancelled', 'no_show', 'refused'].includes(booking.status) && (
          <Link href="/driver" className="block text-center text-blue-700 text-sm font-medium py-3">
            ← Retour à mes courses
          </Link>
        )}
      </main>
    </div>
  )

}
