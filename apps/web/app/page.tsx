'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { calculateFare, getTariffCode } from '@obaid-taxi/shared'
import { getRouteInfo } from '@/lib/google-maps'
import { saveBookingSession } from '@/lib/booking-session'
import Link from 'next/link'

declare global {
  interface Window { google: any }
}

export default function BookingPage() {
  const router = useRouter()

  const [pickup, setPickup] = useState('')
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [dropoff, setDropoff] = useState('')
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [tripType, setTripType] = useState<'one_way' | 'round_trip'>('one_way')
  const [isConventional, setIsConventional] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickupRef = useRef<HTMLInputElement>(null)
  const dropoffRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!window.google) return
    initAutocomplete()
  }, [])

  // Wait for Google Maps to load if not ready yet
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google) { clearInterval(interval); initAutocomplete() }
    }, 200)
    return () => clearInterval(interval)
  }, [])

  function initAutocomplete() {
    const options = { componentRestrictions: { country: 'fr' }, fields: ['formatted_address', 'geometry'] }

    if (pickupRef.current) {
      const ac = new window.google.maps.places.Autocomplete(pickupRef.current, options)
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place.geometry) {
          setPickup(place.formatted_address)
          setPickupCoords({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
        }
      })
    }

    if (dropoffRef.current) {
      const ac = new window.google.maps.places.Autocomplete(dropoffRef.current, options)
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place.geometry) {
          setDropoff(place.formatted_address)
          setDropoffCoords({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
        }
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!pickup || !pickupCoords) { setError('Sélectionnez une adresse de départ dans les suggestions.'); return }
    if (!dropoff || !dropoffCoords) { setError("Sélectionnez une adresse d'arrivée dans les suggestions."); return }
    if (!scheduledAt) { setError('Indiquez la date et l\'heure de la course.'); return }

    setLoading(true)

    const routeInfo = await getRouteInfo(pickup, dropoff)
    if (!routeInfo) { setError('Impossible de calculer l\'itinéraire. Vérifiez les adresses.'); setLoading(false); return }

    const departureTime = new Date(scheduledAt)
    const estimate = calculateFare({
      distanceKm: routeInfo.distance_km,
      durationMin: routeInfo.duration_min,
      departureTime,
      tripType,
    })

    saveBookingSession({
      pickup_address: pickup,
      pickup_lat: pickupCoords.lat,
      pickup_lng: pickupCoords.lng,
      dropoff_address: dropoff,
      dropoff_lat: dropoffCoords.lat,
      dropoff_lng: dropoffCoords.lng,
      scheduled_at: scheduledAt,
      trip_type: tripType,
      is_conventional: isConventional,
      distance_km: routeInfo.distance_km,
      duration_min: routeInfo.duration_min,
      tariff_code: estimate.tariff_code,
      base_price: estimate.base_price,
      estimated_min: estimate.estimated_min,
      estimated_max: estimate.estimated_max,
    })

    router.push('/estimate')
  }

  // Min datetime = now + 30 min
  const minDate = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" className="w-8 h-8 rounded-lg" alt="O Taxi" />
          <span className="font-bold text-gray-900">O Taxi</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/history" className="text-gray-600 hover:text-gray-900 transition-colors">Mes réservations</Link>
          <Link href="/login" className="text-blue-700 font-medium hover:text-blue-800 transition-colors">Connexion</Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-blue-700 text-white px-6 py-10 text-center">
        <h1 className="text-2xl font-bold mb-2">Réservez votre taxi</h1>
        <p className="text-blue-100 text-sm">Mantes-la-Jolie et alentours — Tarif transparent, confirmation rapide</p>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Pickup */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Adresse de départ
              </label>
              <input
                ref={pickupRef}
                type="text"
                value={pickup}
                onChange={e => { setPickup(e.target.value); setPickupCoords(null) }}
                placeholder="10 Rue de la Paix, Mantes-la-Jolie"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoComplete="off"
              />
            </div>

            {/* Dropoff */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Adresse d'arrivée
              </label>
              <input
                ref={dropoffRef}
                type="text"
                value={dropoff}
                onChange={e => { setDropoff(e.target.value); setDropoffCoords(null) }}
                placeholder="Gare de Paris-Saint-Lazare"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoComplete="off"
              />
            </div>

            {/* Date + time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Date et heure de départ
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minDate}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Trip type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de course</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'one_way', label: 'Aller simple' },
                  { value: 'round_trip', label: 'Aller-retour' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTripType(opt.value)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                      tripType === opt.value
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conventionné */}
            <label className="flex items-center gap-3 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConventional}
                onChange={e => setIsConventional(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Course conventionnée (transport médical CPAM)</span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Calcul en cours...' : 'Obtenir une estimation →'}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center pb-8">
          {[
            { icon: '📍', label: 'Mantes-la-Jolie et alentours' },
            { icon: '✅', label: 'Confirmation manuelle rapide' },
            { icon: '💶', label: 'Tarif transparent, pas de surprise' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-3 shadow-sm">
              <div className="text-xl mb-1">{item.icon}</div>
              <p className="text-xs text-gray-600 leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
