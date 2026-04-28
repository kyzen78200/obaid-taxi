'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getGuestHistory, type GuestBookingRecord } from '@/lib/guest-history'

interface Booking {
  id: string
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  status: string
  estimated_min: number
  estimated_max: number
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:                '#F59E0B',
  confirmed:              '#10B981',
  in_progress:            '#1D4ED8',
  completed:              '#3B82F6',
  refused:                '#EF4444',
  cancelled:              '#9CA3AF',
  no_show:                '#9CA3AF',
  cancellation_requested: '#D97706',
}

const STATUS_LABELS: Record<string, string> = {
  pending:                'En attente',
  confirmed:              'Confirmée',
  in_progress:            'En route',
  completed:              'Effectuée',
  refused:                'Refusée',
  cancelled:              'Annulée',
  no_show:                'Non présenté',
  cancellation_requested: 'Annulation demandée',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function BookingCard({ booking }: { booking: Booking | GuestBookingRecord }) {
  const statusColor = STATUS_COLORS[booking.status] ?? '#9CA3AF'
  const statusLabel = STATUS_LABELS[booking.status] ?? booking.status

  return (
    <Link
      href={`/booking/${booking.id}`}
      className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
    >
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-700 shrink-0" />
          <p className="text-sm text-gray-800 truncate">{booking.pickup_address}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
          <p className="text-sm text-gray-600 truncate">{booking.dropoff_address}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{formatDate(booking.scheduled_at)}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-900">
            {booking.estimated_min}–{booking.estimated_max} €
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: statusColor,
              backgroundColor: statusColor + '20',
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guestBookings, setGuestBookings] = useState<GuestBookingRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from('bookings')
          .select('id, pickup_address, dropoff_address, scheduled_at, status, estimated_min, estimated_max, created_at')
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
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  const items = user ? bookings : guestBookings
  const count = items.length

  return (
    <div className="max-w-lg mx-auto px-4 py-5">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Mes courses</h1>
        <p className="text-sm text-gray-400 mt-0.5">{count} course{count !== 1 ? 's' : ''}</p>
      </div>

      {/* Guest banner */}
      {!user && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-blue-700 flex-1">
            Créez un compte pour retrouver vos courses sur tous vos appareils
          </p>
          <Link href="/register" className="text-xs font-bold text-blue-700 underline shrink-0">
            Créer un compte
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-12 h-12 text-gray-200 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2Z" />
            <circle cx="7.5" cy="17" r="1.5" />
            <circle cx="16.5" cy="17" r="1.5" />
          </svg>
          <p className="text-lg font-bold text-gray-900 mb-2">Aucune course pour l'instant</p>
          <p className="text-sm text-gray-400 mb-5">Réservez votre première course !</p>
          <Link
            href="/"
            className="bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl text-sm hover:bg-blue-800 transition-colors"
          >
            Réserver maintenant
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(b => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  )
}
