import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/AdminLayout'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  color?: string
}

function StatCard({ title, value, subtitle, color = 'blue' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-700',
  }
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${colorMap[color]?.split(' ')[1] ?? 'text-gray-900'}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  // Fetch today's bookings by status
  const [
    { count: todayPending },
    { count: todayConfirmed },
    { count: monthTotal },
    { data: monthCompleted },
    { data: pendingBookings },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('scheduled_at', todayStart)
      .lt('scheduled_at', todayEnd),

    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('scheduled_at', todayStart)
      .lt('scheduled_at', todayEnd),

    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),

    supabase
      .from('bookings')
      .select('base_price')
      .eq('status', 'completed')
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),

    supabase
      .from('bookings')
      .select('id, guest_name, guest_phone, pickup_address, dropoff_address, scheduled_at, estimated_min, estimated_max, status, profiles!client_id(full_name, phone)')
      .eq('status', 'pending')
      .order('scheduled_at', { ascending: true })
      .limit(10),
  ])

  const monthRevenue = (monthCompleted ?? []).reduce(
    (sum, b) => sum + (b.base_price ?? 0),
    0
  )

  return (
    <AdminLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {now.toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Aujourd'hui — En attente"
            value={todayPending ?? 0}
            color="yellow"
          />
          <StatCard
            title="Aujourd'hui — Confirmées"
            value={todayConfirmed ?? 0}
            color="blue"
          />
          <StatCard
            title="Ce mois — Courses"
            value={monthTotal ?? 0}
            color="gray"
          />
          <StatCard
            title="Ce mois — Chiffre d'affaires"
            value={`${monthRevenue.toFixed(2)} €`}
            color="green"
          />
        </div>

        {/* Pending bookings table */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Réservations en attente — les plus urgentes
            </h2>
          </div>

          {!pendingBookings || pendingBookings.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              Aucune réservation en attente
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-3">Heure prévue</th>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Trajet</th>
                    <th className="px-6 py-3">Montant estimé</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBookings.map((booking, i) => (
                    <tr
                      key={booking.id}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {new Date(booking.scheduled_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">
                          {(booking as any).profiles?.full_name ?? booking.guest_name ?? '—'}
                        </span>
                        <p className="text-gray-400 text-xs">
                          {(booking as any).profiles?.phone ?? booking.guest_phone ?? ''}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900 truncate max-w-xs">
                          {booking.pickup_address}
                        </p>
                        <p className="text-gray-400 text-xs truncate max-w-xs">
                          → {booking.dropoff_address}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {booking.estimated_min != null && booking.estimated_max != null
                          ? `${booking.estimated_min} – ${booking.estimated_max} €`
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="text-blue-700 hover:text-blue-900 font-medium text-sm"
                        >
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </AdminLayout>
  )
}
