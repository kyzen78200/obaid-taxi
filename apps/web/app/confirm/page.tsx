'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadBookingSession, clearBookingSession, type BookingSession } from '@/lib/booking-session'
import { saveGuestBooking } from '@/lib/guest-history'
import Link from 'next/link'

export default function ConfirmPage() {
  const router = useRouter()
  const supabase = createClient()

  const [session, setSession] = useState<BookingSession | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{ full_name: string; phone: string } | null>(null)

  // Guest form
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const s = loadBookingSession()
    if (!s) { router.push('/'); return }
    setSession(s)

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single()
        if (data) setProfile(data)
      }
    }
    loadUser()
  }, [])

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setError(null)

    if (!user) {
      if (!guestName.trim()) { setError('Votre nom est obligatoire.'); return }
      if (!guestPhone.trim()) { setError('Votre téléphone est obligatoire.'); return }
      if (!guestEmail.trim()) { setError('Votre email est obligatoire.'); return }
    }

    setLoading(true)

    const bookingPayload: any = {
      pickup_address: session.pickup_address,
      pickup_lat: session.pickup_lat,
      pickup_lng: session.pickup_lng,
      dropoff_address: session.dropoff_address,
      dropoff_lat: session.dropoff_lat,
      dropoff_lng: session.dropoff_lng,
      scheduled_at: session.scheduled_at,
      trip_type: session.trip_type,
      is_conventional: session.is_conventional,
      distance_km: session.distance_km,
      duration_min: session.duration_min,
      tariff_code: session.tariff_code,
      base_price: session.base_price,
      estimated_min: session.estimated_min,
      estimated_max: session.estimated_max,
      notes: notes.trim() || null,
      status: 'pending',
    }

    if (user) {
      bookingPayload.client_id = user.id
    } else {
      bookingPayload.guest_name = guestName.trim()
      bookingPayload.guest_phone = guestPhone.trim()
      bookingPayload.guest_email = guestEmail.trim().toLowerCase()
    }

    const { data, error: insertError } = await supabase
      .from('bookings')
      .insert(bookingPayload)
      .select('id')
      .single()

    if (insertError || !data) {
      setError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
      return
    }

    // Save to guest history if not logged in
    if (!user) {
      saveGuestBooking({
        id: data.id,
        pickup_address: session.pickup_address,
        dropoff_address: session.dropoff_address,
        scheduled_at: session.scheduled_at,
        status: 'pending',
        estimated_min: session.estimated_min,
        estimated_max: session.estimated_max,
        created_at: new Date().toISOString(),
      })
    }

    // Notify admin
    fetch(`${process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.otaxi.fr'}/api/notify/booking-created`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: data.id }),
    }).catch(() => {})

    clearBookingSession()
    router.push(`/booking/${data.id}`)
  }

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
        <Link href="/estimate" className="text-blue-700 text-sm font-medium hover:text-blue-800">← Retour</Link>
        <h1 className="text-base font-semibold text-gray-900">Confirmer la réservation</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Résumé */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Récapitulatif</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Départ</p>
                <p className="text-gray-900">{session.pickup_address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Arrivée</p>
                <p className="text-gray-900">{session.dropoff_address}</p>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs text-gray-600">
            <div>
              <p className="text-gray-400">Date</p>
              <p className="font-medium">
                {scheduledDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} à {scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Type</p>
              <p className="font-medium">{session.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'}</p>
            </div>
            <div>
              <p className="text-gray-400">Estimation</p>
              <p className="font-medium text-blue-700">
                {session.estimated_min === session.estimated_max
                  ? `${session.estimated_min} €`
                  : `${session.estimated_min}–${session.estimated_max} €`}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">

          {user ? (
            /* Logged in — show profile */
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Vos coordonnées</h2>
              <div className="text-sm text-gray-700 space-y-1">
                <p><span className="text-gray-400">Nom :</span> {profile?.full_name ?? user.email}</p>
                {profile?.phone && <p><span className="text-gray-400">Téléphone :</span> {profile.phone}</p>}
                <p><span className="text-gray-400">Email :</span> {user.email}</p>
              </div>
              <Link href="/profile" className="text-xs text-blue-700 mt-2 block hover:underline">Modifier mon profil</Link>
            </div>
          ) : (
            /* Guest — collect info */
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Vos coordonnées</h2>
              <p className="text-xs text-gray-400 mb-4">
                Pas de compte ?{' '}
                <Link href="/login" className="text-blue-700 hover:underline">Se connecter</Link>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom et prénom *</label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={e => setGuestPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="jean@exemple.fr"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes optionnelles */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Notes pour le chauffeur <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Bagages, accès PMR, instructions particulières..."
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

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
            {loading ? 'Envoi en cours...' : 'Envoyer la demande de réservation'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Votre réservation sera confirmée par notre gestionnaire sous peu.
          </p>
        </form>
      </div>
    </div>
  )
}
