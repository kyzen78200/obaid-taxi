'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/client'

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'refused' | 'cancelled' | 'no_show'

interface Booking {
  id: string
  guest_name: string | null
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  status: BookingStatus
  estimated_min: number | null
  estimated_max: number | null
}

const statusColors: Record<BookingStatus, string> = {
  pending: 'bg-yellow-100 border-yellow-300 text-yellow-900',
  confirmed: 'bg-blue-100 border-blue-300 text-blue-900',
  completed: 'bg-green-100 border-green-300 text-green-900',
  refused: 'bg-gray-100 border-gray-300 text-gray-600',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-600',
  no_show: 'bg-orange-100 border-orange-300 text-orange-900',
}

const statusLabels: Record<BookingStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  completed: 'Effectuée',
  refused: 'Refusée',
  cancelled: 'Annulée',
  no_show: 'No-show',
}

const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // Monday = 0 in our array; JS getDay: 0=Sun, 1=Mon, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function CalendarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const weekDates = getWeekDates(weekOffset)
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      const from = new Date(weekStart)
      from.setHours(0, 0, 0, 0)
      const to = new Date(weekEnd)
      to.setHours(23, 59, 59, 999)

      const { data } = await supabase
        .from('bookings')
        .select(
          'id, guest_name, pickup_address, dropoff_address, scheduled_at, status, estimated_min, estimated_max'
        )
        .gte('scheduled_at', from.toISOString())
        .lte('scheduled_at', to.toISOString())
        .order('scheduled_at', { ascending: true })

      setBookings((data as Booking[]) ?? [])
      setLoading(false)
    }

    fetchBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  const getBookingsForDay = (date: Date) => {
    return bookings.filter((b) => {
      const bDate = new Date(b.scheduled_at)
      return (
        bDate.getFullYear() === date.getFullYear() &&
        bDate.getMonth() === date.getMonth() &&
        bDate.getDate() === date.getDate()
      )
    })
  }

  const weekLabel = `${weekStart.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })} – ${weekEnd.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <AdminLayout>
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendrier</h1>
            <p className="text-sm text-gray-500 mt-1">{weekLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              ← Semaine précédente
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 transition-colors"
              >
                Aujourd&apos;hui
              </button>
            )}
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Semaine suivante →
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          {(Object.entries(statusLabels) as [BookingStatus, string][]).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className={`w-3 h-3 rounded border ${statusColors[status]}`}
              />
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
            Chargement...
          </div>
        ) : (
          <div className="overflow-x-auto">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden min-w-[640px]">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDates.map((date, i) => {
                const isToday = date.getTime() === today.getTime()
                return (
                  <div
                    key={i}
                    className={`px-3 py-3 text-center border-r last:border-r-0 border-gray-100 ${
                      isToday ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      {dayLabels[i]}
                    </p>
                    <p
                      className={`text-sm font-bold mt-0.5 ${
                        isToday ? 'text-blue-700' : 'text-gray-900'
                      }`}
                    >
                      {date.getDate()}
                    </p>
                    <p className="text-xs text-gray-400">
                      {date.toLocaleDateString('fr-FR', { month: 'short' })}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Booking cells */}
            <div className="grid grid-cols-7">
              {weekDates.map((date, i) => {
                const dayBookings = getBookingsForDay(date)
                const isToday = date.getTime() === today.getTime()

                return (
                  <div
                    key={i}
                    className={`border-r last:border-r-0 border-gray-100 p-1.5 space-y-1 min-h-[60px] ${
                      isToday ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    {dayBookings.length === 0 && (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-xs text-gray-300">—</span>
                      </div>
                    )}
                    {dayBookings.map((booking) => {
                      const time = new Date(booking.scheduled_at).toLocaleTimeString(
                        'fr-FR',
                        { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }
                      )
                      const colorClass =
                        statusColors[booking.status] ?? 'bg-gray-100 border-gray-300 text-gray-800'

                      return (
                        <button
                          key={booking.id}
                          onClick={() => router.push(`/bookings/${booking.id}`)}
                          className={`w-full text-left px-1.5 py-1 rounded border text-xs cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
                        >
                          <p className="font-bold leading-tight">{time}</p>
                          <p className="truncate font-medium leading-tight">
                            {booking.guest_name ?? 'Client'}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
          </div>
        )}

        {/* Summary */}
        <div className="mt-4 text-sm text-gray-500 text-right">
          {bookings.length} réservation{bookings.length !== 1 ? 's' : ''} cette semaine
        </div>
    </AdminLayout>
  )
}
