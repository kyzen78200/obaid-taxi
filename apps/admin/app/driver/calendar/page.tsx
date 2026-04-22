'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import { Clock, MapPin, Flag, Ruler, Euro } from '@/components/Icons'

interface DriverBooking {
  id: string
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  status: string
  base_price: number | null
  estimated_min: number | null
  estimated_max: number | null
  distance_km: number | null
  duration_min: number | null
}

type ViewMode = 'week' | 'month'

const DAYS_FR        = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const WEEK_HEADER_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR      = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // starts Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  )
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Returns an array of 42 cells (6 weeks × 7 days), null for padding days. */
function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay    = new Date(year, month, 1)
  const lastDay     = new Date(year, month + 1, 0)
  const startDow    = firstDay.getDay() // 0=Sun
  // Offset so week starts on Monday (0→6 padding, 1→0, 2→1, …)
  const offset      = startDow === 0 ? 6 : startDow - 1

  const cells: (Date | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d))
  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const STATUS_DOT: Record<string, string> = {
  pending:                'bg-yellow-400',
  confirmed:              'bg-blue-500',
  in_progress:            'bg-indigo-500',
  completed:              'bg-green-500',
  cancelled:              'bg-gray-400',
  refused:                'bg-red-400',
  no_show:                'bg-orange-400',
  cancellation_requested: 'bg-amber-400',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DriverCalendarPage() {
  const supabase = createClient()

  const [driverId, setDriverId]   = useState<string | null>(null)
  const [bookings, setBookings]   = useState<DriverBooking[]>([])
  const [loading, setLoading]     = useState(true)

  const [viewMode, setViewMode]   = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [monthDate, setMonthDate] = useState<Date>(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })

  const today = new Date()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single()
    if (!driver) return
    setDriverId(driver.id)
    await loadBookings(driver.id)
    setLoading(false)
  }

  async function loadBookings(id: string) {
    const { data } = await supabase
      .from('bookings')
      .select('id, pickup_address, dropoff_address, scheduled_at, status, base_price, estimated_min, estimated_max, distance_km, duration_min')
      .eq('driver_id', id)
      .order('scheduled_at', { ascending: true })
    setBookings(data ?? [])
  }

  function goToToday() {
    const n = new Date()
    setWeekStart(startOfWeek(n))
    setSelectedDay(n)
    setMonthDate(new Date(n.getFullYear(), n.getMonth(), 1))
  }

  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const monthGrid = getMonthGrid(monthDate.getFullYear(), monthDate.getMonth())

  const bookingsOnDay = (day: Date) =>
    bookings.filter(b => isSameDay(new Date(b.scheduled_at), day))

  const selectedDayBookings = bookingsOnDay(selectedDay)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto p-5">

      {/* Page header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <div className="flex items-center gap-2">

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 font-medium transition-colors ${
                viewMode === 'week' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 font-medium border-l border-gray-200 transition-colors ${
                viewMode === 'month' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Mois
            </button>
          </div>

          {/* Today */}
          <button
            onClick={goToToday}
            className="text-xs text-blue-700 font-medium border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* ── WEEK VIEW ─────────────────────────────────────────────────────────── */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          {/* Month + arrows */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-gray-800">
              {MONTHS_FR[weekStart.getMonth()]} {weekStart.getFullYear()}
              {weekStart.getMonth() !== addDays(weekStart, 6).getMonth() &&
                ` — ${MONTHS_FR[addDays(weekStart, 6).getMonth()]}`}
            </p>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              ›
            </button>
          </div>

          {/* Days row */}
          <div className="grid grid-cols-7">
            {weekDays.map((day, i) => {
              const isToday    = isSameDay(day, today)
              const isSelected = isSameDay(day, selectedDay)
              const count      = bookingsOnDay(day).length
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center py-3 gap-1 transition-colors ${
                    isSelected ? 'bg-blue-600' : isToday ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-xs font-medium ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                    {DAYS_FR[day.getDay()]}
                  </span>
                  <span className={`text-sm font-bold ${
                    isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-gray-800'
                  }`}>
                    {day.getDate()}
                  </span>
                  {count > 0
                    ? <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                    : <span className="w-1.5 h-1.5" />
                  }
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MONTH VIEW ────────────────────────────────────────────────────────── */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          {/* Month + arrows */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <button
              onClick={() => setMonthDate(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-gray-800">
              {MONTHS_FR[monthDate.getMonth()]} {monthDate.getFullYear()}
            </p>
            <button
              onClick={() => setMonthDate(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              ›
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEK_HEADER_FR.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {monthGrid.map((day, i) => {
              if (!day) {
                return <div key={i} className="aspect-square border-t border-l border-gray-50 first:border-l-0" />
              }
              const isToday    = isSameDay(day, today)
              const isSelected = isSameDay(day, selectedDay)
              const count      = bookingsOnDay(day).length

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square flex flex-col items-center justify-center gap-0.5 border-t border-l border-gray-50 transition-colors hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-600 hover:bg-blue-600' : ''
                  }`}
                >
                  <span className={`text-sm font-semibold leading-none ${
                    isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-gray-700'
                  }`}>
                    {day.getDate()}
                  </span>
                  {count > 0
                    ? <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                    : <span className="w-1.5 h-1.5" />
                  }
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Selected day header ────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          {DAYS_FR[selectedDay.getDay()]} {selectedDay.getDate()} {MONTHS_FR[selectedDay.getMonth()]}
        </h2>
        <span className="text-sm text-gray-400">
          {selectedDayBookings.length} course{selectedDayBookings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Booking cards ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
        </div>
      ) : selectedDayBookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm px-6 py-10 text-center text-gray-400 text-sm">
          Aucune course ce jour
        </div>
      ) : (
        <div className="space-y-3">
          {selectedDayBookings.map(booking => (
            <Link
              key={booking.id}
              href={`/driver/bookings/${booking.id}`}
              className="block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="flex">
                {/* Status color strip */}
                <div className={`w-1 flex-shrink-0 ${STATUS_DOT[booking.status] ?? 'bg-gray-300'}`} />

                <div className="flex-1 px-4 py-4">
                  {/* Time + status */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {formatTime(booking.scheduled_at)}
                    </span>
                    <StatusBadge status={booking.status} />
                  </div>

                  {/* Route */}
                  <div className="space-y-1">
                    <div className="flex gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{booking.pickup_address}</span>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <Flag className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{booking.dropoff_address}</span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
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
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
