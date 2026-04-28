'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadBookingSession, type BookingSession } from '@/lib/booking-session'
import Link from 'next/link'

const TARIFF_LABELS: Record<string, string> = {
  A: 'Aller-retour Jour (0,99 €/km)',
  B: 'Aller-retour Nuit (1,49 €/km)',
  C: 'Aller simple Jour (1,98 €/km)',
  D: 'Aller simple Nuit (2,97 €/km)',
}

export default function EstimatePage() {
  const router = useRouter()
  const [session, setSession] = useState<BookingSession | null>(null)

  useEffect(() => {
    const s = loadBookingSession()
    if (!s) { router.push('/'); return }
    setSession(s)
  }, [])

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  const scheduledDate = new Date(session.scheduled_at)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-blue-700 text-sm font-medium hover:text-blue-800">← Modifier</Link>
        <h1 className="text-base font-semibold text-gray-900">Estimation de prix</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Estimation principale */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <p className="text-xs text-gray-400 font-medium mb-1">Estimation</p>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-bold text-gray-900">
              {session.estimated_min === session.estimated_max
                ? `${session.estimated_min} €`
                : `${session.estimated_min} – ${session.estimated_max} €`}
            </span>
          </div>
          <p className="text-xs text-gray-400">Prix final confirmé par le gestionnaire</p>

          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
            {session.forfait_name ? (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 font-medium mb-0.5">Forfait</p>
                <p className="text-gray-700">{session.forfait_name}</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Tarif appliqué</p>
                  <p className="text-gray-700">{TARIFF_LABELS[session.tariff_code] ?? `Tarif ${session.tariff_code}`}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Distance estimée</p>
                  <p className="text-gray-700">{session.distance_km} km — {session.duration_min} min</p>
                </div>
              </>
            )}
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Type de course</p>
              <p className="text-gray-700">{session.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'}</p>
            </div>
            {session.is_conventional && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Conventionné</p>
                <p className="text-gray-700">Oui</p>
              </div>
            )}
          </div>
        </div>

        {/* Trajet */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Map */}
          {session.pickup_lat && session.dropoff_lat && (
            <img
              src={`https://maps.googleapis.com/maps/api/staticmap?size=600x180&maptype=roadmap&markers=color:blue%7Clabel:A%7C${session.pickup_lat},${session.pickup_lng}&markers=color:green%7Clabel:B%7C${session.dropoff_lat},${session.dropoff_lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
              alt="Carte du trajet"
              className="w-full h-40 object-cover"
            />
          )}
          <div className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Votre trajet</h2>

          <div className="space-y-2">
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium">Départ</p>
                <p className="text-sm text-gray-900">{session.pickup_address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium">Arrivée</p>
                <p className="text-sm text-gray-900">{session.dropoff_address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium">Date et heure</p>
                <p className="text-sm text-gray-900">
                  {scheduledDate.toLocaleString('fr-FR', {
                    weekday: 'long', day: '2-digit', month: 'long',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-700 leading-relaxed">
            Cette estimation est une fourchette indicative. Le prix final sera confirmé par le gestionnaire lors de la validation de votre réservation.
          </p>
        </div>

        <button
          onClick={() => router.push('/confirm')}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
        >
          Confirmer la réservation →
        </button>

        <Link href="/" className="block text-center text-sm text-gray-500 hover:text-gray-700 py-1">
          Modifier ma recherche
        </Link>
      </div>
    </div>
  )
}
