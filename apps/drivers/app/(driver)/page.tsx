'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, Ban, AlertTriangle, MapPin, Flag, Ruler, Euro, FileText } from '@/components/Icons'

interface DriverBooking {
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
}

type DriverStatus = 'loading' | 'approved' | 'pending' | 'revoked' | 'unknown'

export default function DriverDashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('loading')
  const [driverRecord, setDriverRecord] = useState<{ id: string; first_name: string; last_name: string } | null>(null)
  const [bookings, setBookings] = useState<DriverBooking[]>([])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, first_name, last_name, status')
      .eq('user_id', user.id)
      .single()

    if (!driver) { setDriverStatus('unknown'); return }

    const status = driver.status as DriverStatus
    setDriverStatus(status)

    if (status === 'approved') {
      setDriverRecord({ id: driver.id, first_name: driver.first_name, last_name: driver.last_name })
      await loadBookings(driver.id)
    }
  }

  async function loadBookings(driverId: string) {
    const { data } = await supabase
      .from('bookings')
      .select('id, guest_name, guest_phone, pickup_address, dropoff_address, scheduled_at, base_price, estimated_min, estimated_max, status, notes, distance_km, duration_min')
      .eq('driver_id', driverId)
      .not('status', 'in', '(completed,cancelled,refused,no_show)')
      .order('scheduled_at', { ascending: true })
    setBookings(data ?? [])
  }

  if (driverStatus === 'loading') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  if (driverStatus === 'pending') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
          <div className="flex justify-center mb-4"><Clock className="w-12 h-12 text-amber-500" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Compte en cours de révision</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Votre demande d'inscription est en cours d'examen par l'administrateur.
            Vous recevrez un e-mail de confirmation dès que votre compte sera validé.
          </p>
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              La validation prend généralement moins de 24 h.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (driverStatus === 'revoked') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
          <div className="flex justify-center mb-4"><Ban className="w-12 h-12 text-red-500" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Compte révoqué</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Votre compte chauffeur a été révoqué. Pour toute demande de réactivation,
            veuillez contacter l'administrateur du site.
          </p>
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs text-red-700">
              Si vous pensez qu'il s'agit d'une erreur, contactez le support.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (driverStatus === 'unknown') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
          <div className="flex justify-center mb-4"><AlertTriangle className="w-12 h-12 text-yellow-500" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Accès non autorisé</h1>
          <p className="text-sm text-gray-500 mb-4">
            Aucun compte chauffeur n'est associé à cet e-mail.
          </p>
          <Link href="/login" className="text-blue-700 text-sm font-medium hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-5">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Mes courses</h1>
        <p className="text-sm text-gray-500 mt-1">
          {bookings.length} course{bookings.length !== 1 ? 's' : ''} en cours ou à venir
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm px-6 py-12 text-center text-gray-400 text-sm">
          Aucune course assignée pour le moment
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {new Date(booking.scheduled_at).toLocaleString('fr-FR', {
                      weekday: 'long', day: '2-digit', month: 'long',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">#{booking.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <div className="px-5 py-4 space-y-2">
                <div className="flex gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Départ</p>
                    <p className="text-sm text-gray-900">{booking.pickup_address}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Flag className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Arrivée</p>
                    <p className="text-sm text-gray-900">{booking.dropoff_address}</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-1 text-xs text-gray-500">
                  {booking.distance_km != null && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> {booking.distance_km} km</span>}
                  {booking.duration_min != null && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {booking.duration_min} min</span>}
                  <span className="flex items-center gap-1">
                    <Euro className="w-3.5 h-3.5" /> {booking.base_price != null
                      ? `${booking.base_price.toFixed(2)} €`
                      : booking.estimated_min != null
                      ? `~${booking.estimated_min}–${booking.estimated_max} €`
                      : '—'}
                  </span>
                </div>

                {booking.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-1">
                    <p className="text-xs text-yellow-800 flex items-center gap-1"><FileText className="w-3.5 h-3.5 flex-shrink-0" /> {booking.notes}</p>
                  </div>
                )}
              </div>

              <div className="px-5 pb-4">
                <span className="text-sm text-blue-700 font-medium">Voir le détail →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
