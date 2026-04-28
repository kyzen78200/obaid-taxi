'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getGuestHistory, type GuestBookingRecord } from '@/lib/guest-history'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

interface Booking {
  id: string
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  status: string
  estimated_min: number
  estimated_max: number
  base_price: number | null
  created_at: string
}

export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [guestBookings, setGuestBookings] = useState<GuestBookingRecord[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from('bookings')
          .select('id, pickup_address, dropoff_address, scheduled_at, status, estimated_min, estimated_max, base_price, created_at')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        setBookings(data ?? [])
      } else {
        setGuestBookings(getGuestHistory())
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  const items = user ? bookings : guestBookings

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-blue-700 text-sm font-medium hover:text-blue-800">← Accueil</Link>
        <h1 className="text-base font-semibold text-gray-900">Mes réservations</h1>
        {user ? (
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            className="text-gray-400 text-sm hover:text-gray-600"
          >
            Déconnexion
          </button>
        ) : (
          <Link href="/login" className="text-blue-700 text-sm font-medium">Connexion</Link>
        )}
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {!user && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700">
              Vous êtes en mode invité. <Link href="/login" className="font-medium underline">Connectez-vous</Link> pour retrouver toutes vos réservations.
            </p>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm mb-4">Aucune réservation pour l'instant.</p>
            <Link href="/" className="text-blue-700 font-medium text-sm hover:underline">
              Faire une réservation →
            </Link>
          </div>
        ) : (
          items.map(b => {
            const scheduled = new Date(b.scheduled_at)
            const price = ('base_price' in b && b.base_price != null)
              ? `${(b.base_price as number).toFixed(2)} €`
              : `${b.estimated_min}–${b.estimated_max} €`

            return (
              <Link
                key={b.id}
                href={`/booking/${b.id}`}
                className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.pickup_address}</p>
                    <p className="text-xs text-gray-400 truncate">→ {b.dropoff_address}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {scheduled.toLocaleString('fr-FR', {
                      day: '2-digit', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="font-semibold text-gray-900">{price}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
