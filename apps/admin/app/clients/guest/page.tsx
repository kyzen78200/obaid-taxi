import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/AdminLayout'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function GuestClientDetailPage({
  searchParams,
}: {
  searchParams: { phone?: string }
}) {
  const phone = searchParams.phone
  if (!phone) notFound()

  const supabase = createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, guest_name, guest_phone, guest_email, pickup_address, dropoff_address, scheduled_at, status, base_price, estimated_min, estimated_max, created_at')
    .eq('guest_phone', phone)
    .order('scheduled_at', { ascending: false })

  if (!bookings || bookings.length === 0) notFound()

  const firstBooking = bookings[0]
  const noShowCount = bookings.filter(b => b.status === 'no_show').length
  const totalRides  = bookings.filter(b => b.status === 'completed').length
  const totalSpent  = bookings
    .filter(b => b.status === 'completed' && b.base_price != null)
    .reduce((sum, b) => sum + (b.base_price ?? 0), 0)

  return (
    <AdminLayout>
        <div className="mb-6">
          <Link href="/clients" className="text-gray-400 hover:text-gray-600 text-sm mb-1 inline-block">
            ← Clients
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{firstBooking.guest_name ?? 'Invité'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Client invité</p>
        </div>

        {/* No-show alert */}
        {noShowCount > 0 && (
          <div className="mb-6 bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <p className="font-semibold text-red-900">Attention — {noShowCount} no-show enregistré{noShowCount > 1 ? 's' : ''}</p>
              <p className="text-sm text-red-700 mt-0.5">Ce client ne s'est pas présenté à {noShowCount} reprise{noShowCount > 1 ? 's' : ''}.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Info card */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-500 text-xl">🚶</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{firstBooking.guest_name ?? 'Invité'}</p>
                  <p className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full inline-block mt-1">Sans compte</p>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Téléphone</dt>
                  <dd className="text-gray-900 font-medium">{phone}</dd>
                </div>
                {firstBooking.guest_email && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Email</dt>
                    <dd className="text-gray-900 font-medium text-xs">{firstBooking.guest_email}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Première course</dt>
                  <dd className="text-gray-900 text-xs">
                    {new Date(bookings[bookings.length - 1].created_at).toLocaleDateString('fr-FR')}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 text-sm">Statistiques</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <p className="text-2xl font-bold text-blue-700">{totalRides}</p>
                  <p className="text-xs text-blue-600 mt-1">Courses</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-2xl font-bold text-green-700">{totalSpent.toFixed(0)}€</p>
                  <p className="text-xs text-green-600 mt-1">Total</p>
                </div>
                <div className={`col-span-2 text-center p-3 rounded-xl ${noShowCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${noShowCount > 0 ? 'text-red-700' : 'text-gray-400'}`}>{noShowCount}</p>
                  <p className={`text-xs mt-1 ${noShowCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>No-show</p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking history */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Historique des courses</h2>
                <span className="text-sm text-gray-400">{bookings.length}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Trajet</th>
                    <th className="px-6 py-3">Montant</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking, i) => (
                    <tr key={booking.id} className={`hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700 text-xs">
                        {new Date(booking.scheduled_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-3 max-w-xs">
                        <p className="text-gray-900 truncate text-xs">{booking.pickup_address}</p>
                        <p className="text-xs text-gray-400 truncate">→ {booking.dropoff_address}</p>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700 text-xs">
                        {booking.base_price != null ? `${booking.base_price.toFixed(2)} €`
                          : booking.estimated_min != null ? `~${booking.estimated_min}–${booking.estimated_max} €` : '—'}
                      </td>
                      <td className="px-6 py-3"><StatusBadge status={booking.status} /></td>
                      <td className="px-6 py-3">
                        <Link href={`/bookings/${booking.id}`} className="text-blue-700 hover:text-blue-900 font-medium text-xs">
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
    </AdminLayout>
  )
}
