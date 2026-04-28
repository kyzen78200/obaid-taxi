'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import { RefreshCw, Search, MapPin, Flag, Ruler, Clock, Euro, FileText, Megaphone, Car, Cross } from '@/components/Icons'

interface BroadcastBooking {
  id: string
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  trip_type: string
  is_conventional: boolean
  distance_km: number | null
  duration_min: number | null
  base_price: number | null
  estimated_min: number | null
  estimated_max: number | null
  notes: string | null
  status: string
}

export default function DriverSearchPage() {
  const supabase = createClient()
  const router = useRouter()

  const [driverId, setDriverId]         = useState<string | null>(null)
  const [bookings, setBookings]         = useState<BroadcastBooking[]>([])
  const [loading, setLoading]           = useState(true)
  const [taking, setTaking]             = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: driver } = await supabase
        .from('drivers')
        .select('id, status')
        .eq('user_id', user.id)
        .single()

      if (!driver || driver.status !== 'approved') {
        setLoading(false)
        return
      }

      setDriverId(driver.id)
      await loadBroadcastBookings()
      setLoading(false)

      channel = supabase
        .channel('broadcast-bookings')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: 'is_broadcast=eq.true',
        }, (payload) => {
          const updated = payload.new as BroadcastBooking & { driver_id: string | null }
          if (updated.driver_id != null) {
            setBookings(prev => prev.filter(b => b.id !== updated.id))
          }
        })
        .subscribe()
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  async function loadBroadcastBookings() {
    const { data } = await supabase
      .from('bookings')
      .select('id, pickup_address, dropoff_address, scheduled_at, trip_type, is_conventional, distance_km, duration_min, base_price, estimated_min, estimated_max, notes, status')
      .eq('is_broadcast', true)
      .in('status', ['pending', 'confirmed'])
      .is('driver_id', null)
      .order('scheduled_at', { ascending: true })

    setBookings(data ?? [])
  }

  function showNotif(message: string, type: 'success' | 'error') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  async function handleTake(bookingId: string) {
    if (!driverId) return
    setTaking(bookingId)

    const { data, error } = await supabase
      .from('bookings')
      .update({ driver_id: driverId, is_broadcast: false, status: 'confirmed' })
      .eq('id', bookingId)
      .in('status', ['pending', 'confirmed'])
      .is('driver_id', null)
      .select('id')
      .single()

    if (error || !data) {
      showNotif('Cette course a déjà été prise par un autre chauffeur.', 'error')
      setBookings(prev => prev.filter(b => b.id !== bookingId))
    } else {
      showNotif('Course prise ! Elle apparaît maintenant dans "Mes courses".', 'success')
      setBookings(prev => prev.filter(b => b.id !== bookingId))
      setTimeout(() => router.push(`/bookings/${bookingId}`), 1500)
    }

    setTaking(null)
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-5">
      {notification && (
        <div className={`fixed top-20 left-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-center ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Chercher des courses</h1>
        <p className="text-sm text-gray-500 mt-1">
          {bookings.length} course{bookings.length !== 1 ? 's' : ''} disponible{bookings.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={() => { setLoading(true); loadBroadcastBookings().then(() => setLoading(false)) }}
          className="text-xs text-blue-700 font-medium border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm px-6 py-12 text-center">
          <div className="flex justify-center mb-4"><Search className="w-10 h-10 text-gray-300" /></div>
          <p className="text-gray-500 text-sm">Aucune course disponible pour le moment.</p>
          <p className="text-gray-400 text-xs mt-2">Les nouvelles courses apparaissent ici en temps réel.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-blue-100">
              <div className="bg-blue-600 px-5 py-2 flex items-center gap-2">
                <Megaphone className="w-3.5 h-3.5 text-white" />
                <span className="text-white text-xs font-semibold">Course disponible</span>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">
                    {new Date(booking.scheduled_at).toLocaleString('fr-FR', {
                      weekday: 'long', day: '2-digit', month: 'long',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {booking.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'}
                  </span>
                </div>

                <div className="space-y-2">
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
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  {booking.distance_km != null && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> {booking.distance_km} km</span>}
                  {booking.duration_min != null && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {booking.duration_min} min</span>}
                  <span className="font-semibold text-gray-700 flex items-center gap-1">
                    <Euro className="w-3.5 h-3.5" /> {booking.base_price != null
                      ? `${booking.base_price.toFixed(2)} €`
                      : booking.estimated_min != null
                      ? `~${booking.estimated_min}–${booking.estimated_max} €`
                      : '—'}
                  </span>
                  {booking.is_conventional && (
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Cross className="w-3 h-3" /> Conventionné
                    </span>
                  )}
                </div>

                {booking.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-yellow-800 flex items-center gap-1"><FileText className="w-3.5 h-3.5 flex-shrink-0" /> {booking.notes}</p>
                  </div>
                )}

                <button
                  onClick={() => handleTake(booking.id)}
                  disabled={taking === booking.id}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm mt-2"
                >
                  {taking === booking.id
                    ? <span className="flex items-center justify-center gap-2"><Clock className="w-4 h-4" /> Prise en cours...</span>
                    : <span className="flex items-center justify-center gap-2"><Car className="w-4 h-4" /> Prendre cette course</span>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
