'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { calculateFare } from '@obaid-taxi/shared'
import { getRouteInfo } from '@/lib/google-maps'
import { saveBookingSession } from '@/lib/booking-session'
import { haversineDistance } from '@/lib/haversine'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'

declare global {
  interface Window { google: any }
}

interface Destination {
  name: string
  type: 'station' | 'airport'
  lat: number
  lng: number
}

interface Zone {
  id: string
  name: string
  center_lat: number
  center_lng: number
  radius_km: number
}

export default function BookingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [pickup, setPickup] = useState('')
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [dropoff, setDropoff] = useState('')
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [tripType, setTripType] = useState<'one_way' | 'round_trip'>('one_way')
  const [isConventional, setIsConventional] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forfait
  const [forfaitMode, setForfaitMode] = useState(false)
  const [forfaitDirection, setForfaitDirection] = useState<'to' | 'from'>('to')
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null)

  const pickupRef = useRef<HTMLInputElement>(null)
  const dropoffRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Charger les destinations uniques (dédupliquées par nom)
    supabase.from('fare_packages').select('name, type, lat, lng').eq('active', true)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<string>()
        const unique: Destination[] = []
        for (const d of data) {
          if (!seen.has(d.name)) { seen.add(d.name); unique.push(d as Destination) }
        }
        setDestinations(unique)
      })

    // Charger les zones pour la résolution des prix forfait
    supabase.from('zones').select('id, name, center_lat, center_lng, radius_km').eq('active', true)
      .then(({ data }) => { if (data) setZones(data as Zone[]) })
  }, [])

  useEffect(() => {
    if (!window.google) return
    initAutocomplete()
  }, [])

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
    if (!scheduledAt) { setError('Indiquez la date et l\'heure de la course.'); return }

    if (forfaitMode) {
      if (!selectedDest) { setError('Sélectionnez une destination.'); return }
      setLoading(true)

      const destCoords = { lat: selectedDest.lat, lng: selectedDest.lng }
      const clientCoords = forfaitDirection === 'to' ? pickupCoords : destCoords
      const originCoords = forfaitDirection === 'to' ? pickupCoords : destCoords
      const dropoffCoordsFinal = forfaitDirection === 'to' ? destCoords : pickupCoords

      // Trouver la zone correspondant à l'adresse du client
      const matchingZones = zones.filter(z => {
        const dist = haversineDistance(
          { lat: clientCoords.lat, lng: clientCoords.lng },
          { lat: z.center_lat, lng: z.center_lng }
        )
        return dist <= z.radius_km
      })

      // Zone la plus proche si plusieurs correspondent
      let closestZone: Zone | null = null
      if (matchingZones.length === 1) {
        closestZone = matchingZones[0]
      } else if (matchingZones.length > 1) {
        closestZone = matchingZones.reduce((best, z) => {
          const d1 = haversineDistance({ lat: clientCoords.lat, lng: clientCoords.lng }, { lat: best.center_lat, lng: best.center_lng })
          const d2 = haversineDistance({ lat: clientCoords.lat, lng: clientCoords.lng }, { lat: z.center_lat, lng: z.center_lng })
          return d2 < d1 ? z : best
        })
      }

      const pickupAddr = forfaitDirection === 'to' ? pickup : selectedDest.name
      const dropoffAddr = forfaitDirection === 'to' ? selectedDest.name : pickup

      if (!closestZone) {
        // Adresse hors de toute zone — fallback km estimate
        const routeInfo = await getRouteInfo(pickupAddr, dropoffAddr)
        if (!routeInfo) { setError('Impossible de calculer l\'itinéraire. Vérifiez les adresses.'); setLoading(false); return }
        const departureTime = new Date(scheduledAt)
        const estimate = calculateFare({ distanceKm: routeInfo.distance_km, durationMin: routeInfo.duration_min, departureTime, tripType: 'one_way' })
        saveBookingSession({
          pickup_address: pickupAddr, pickup_lat: originCoords.lat, pickup_lng: originCoords.lng,
          dropoff_address: dropoffAddr, dropoff_lat: dropoffCoordsFinal.lat, dropoff_lng: dropoffCoordsFinal.lng,
          scheduled_at: scheduledAt, trip_type: 'one_way', is_conventional: isConventional,
          distance_km: routeInfo.distance_km, duration_min: routeInfo.duration_min,
          tariff_code: estimate.tariff_code, base_price: estimate.base_price,
          estimated_min: estimate.estimated_min, estimated_max: estimate.estimated_max,
          forfait_id: null, forfait_name: null,
        })
        router.push('/estimate')
        return
      }

      // Chercher le forfait pour cette zone × cette destination
      const { data: pkg } = await supabase
        .from('fare_packages')
        .select('id, price')
        .eq('zone_id', closestZone.id)
        .eq('name', selectedDest.name)
        .eq('active', true)
        .single()

      if (!pkg) {
        // Pas de forfait pour cette zone × destination — fallback km
        const routeInfo = await getRouteInfo(pickupAddr, dropoffAddr)
        if (!routeInfo) { setError('Impossible de calculer l\'itinéraire.'); setLoading(false); return }
        const departureTime = new Date(scheduledAt)
        const estimate = calculateFare({ distanceKm: routeInfo.distance_km, durationMin: routeInfo.duration_min, departureTime, tripType: 'one_way' })
        saveBookingSession({
          pickup_address: pickupAddr, pickup_lat: originCoords.lat, pickup_lng: originCoords.lng,
          dropoff_address: dropoffAddr, dropoff_lat: dropoffCoordsFinal.lat, dropoff_lng: dropoffCoordsFinal.lng,
          scheduled_at: scheduledAt, trip_type: 'one_way', is_conventional: isConventional,
          distance_km: routeInfo.distance_km, duration_min: routeInfo.duration_min,
          tariff_code: estimate.tariff_code, base_price: estimate.base_price,
          estimated_min: estimate.estimated_min, estimated_max: estimate.estimated_max,
          forfait_id: null, forfait_name: null,
        })
        router.push('/estimate')
        return
      }

      // Forfait trouvé — tariff_code calculé depuis l'heure de départ (enum A/B/C/D)
      const forfaitEstimate = calculateFare({
        distanceKm: 0, durationMin: 0,
        departureTime: new Date(scheduledAt),
        tripType: 'one_way',
        forfaitPrice: pkg.price,
        forfaitName: selectedDest.name,
      })
      saveBookingSession({
        pickup_address: pickupAddr, pickup_lat: originCoords.lat, pickup_lng: originCoords.lng,
        dropoff_address: dropoffAddr, dropoff_lat: dropoffCoordsFinal.lat, dropoff_lng: dropoffCoordsFinal.lng,
        scheduled_at: scheduledAt, trip_type: 'one_way', is_conventional: isConventional,
        distance_km: 0, duration_min: 0,
        tariff_code: forfaitEstimate.tariff_code, base_price: pkg.price,
        estimated_min: pkg.price, estimated_max: pkg.price,
        forfait_id: pkg.id, forfait_name: selectedDest.name,
      })
      router.push('/estimate')
      return
    }

    if (!dropoff || !dropoffCoords) { setError("Sélectionnez une adresse d'arrivée dans les suggestions."); return }

    setLoading(true)
    const routeInfo = await getRouteInfo(pickup, dropoff)
    if (!routeInfo) { setError('Impossible de calculer l\'itinéraire. Vérifiez les adresses.'); setLoading(false); return }

    const departureTime = new Date(scheduledAt)
    const estimate = calculateFare({ distanceKm: routeInfo.distance_km, durationMin: routeInfo.duration_min, departureTime, tripType })

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
      forfait_id: null,
      forfait_name: null,
    })

    router.push('/estimate')
  }

  const minDate = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16)
  const gares = destinations.filter(d => d.type === 'station')
  const aeroports = destinations.filter(d => d.type === 'airport')

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero */}
      <div className="bg-blue-700 text-white px-6 py-10 text-center">
        <h1 className="text-2xl font-bold mb-2">Réservez votre taxi</h1>
        <p className="text-blue-100 text-sm">Mantes-la-Jolie et alentours — Tarif transparent, confirmation rapide</p>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Toggle forfait */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setForfaitMode(false); setSelectedDest(null) }}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${!forfaitMode ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'}`}
              >
                Course standard
              </button>
              <button
                type="button"
                onClick={() => setForfaitMode(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${forfaitMode ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'}`}
              >
                🚉 Gare / Aéroport
              </button>
            </div>

            {/* Pickup */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse de départ</label>
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

            {/* Forfait mode */}
            {forfaitMode ? (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-blue-700">Le prix forfaitaire est calculé selon votre zone de départ.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'to', label: 'Aller vers →' },
                      { value: 'from', label: '← Venir de' },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button" onClick={() => setForfaitDirection(opt.value)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-colors border ${forfaitDirection === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                  {destinations.length === 0 ? (
                    <p className="text-sm text-gray-400">Chargement...</p>
                  ) : (
                    <div className="space-y-2">
                      {gares.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">🚉 Gares</p>
                          {gares.map(dest => (
                            <button key={dest.name} type="button"
                              onClick={() => setSelectedDest(dest)}
                              className={`w-full text-left px-4 py-3 rounded-xl text-sm border mb-1 transition-colors ${selectedDest?.name === dest.name ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'}`}>
                              {dest.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {aeroports.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">✈️ Aéroports</p>
                          {aeroports.map(dest => (
                            <button key={dest.name} type="button"
                              onClick={() => setSelectedDest(dest)}
                              className={`w-full text-left px-4 py-3 rounded-xl text-sm border mb-1 transition-colors ${selectedDest?.name === dest.name ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'}`}>
                              {dest.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse d'arrivée</label>
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
            )}

            {/* Date + time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date et heure de départ</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minDate}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Trip type (masqué en mode forfait) */}
            {!forfaitMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de course</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'one_way', label: 'Aller simple' },
                    { value: 'round_trip', label: 'Aller-retour' },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setTripType(opt.value)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-colors border ${tripType === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {isConventional && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-700">
                  Vous pourrez joindre votre attestation de transport (PDF) à l'étape suivante.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm">
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
