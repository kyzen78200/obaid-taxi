import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/AdminLayout'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

const PAGE_SIZE = 20

type BookingStatus =
  | 'all'
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'refused'
  | 'cancelled'
  | 'no_show'
  | 'cancellation_requested'

type SortBy = 'scheduled_at' | 'guest_name' | 'driver_id' | 'base_price' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

const statusOptions: { value: BookingStatus; label: string }[] = [
  { value: 'all',                   label: 'Tous les statuts' },
  { value: 'pending',               label: 'En attente' },
  { value: 'confirmed',             label: 'Confirmée' },
  { value: 'in_progress',           label: 'En route' },
  { value: 'cancellation_requested',label: 'Annulation demandée' },
  { value: 'completed',             label: 'Effectuée' },
  { value: 'refused',               label: 'Refusée' },
  { value: 'cancelled',             label: 'Annulée' },
  { value: 'no_show',               label: 'No-show' },
]

interface SearchParams {
  status?: string
  from?: string
  to?: string
  search?: string
  page?: string
  driver_id?: string
  sort_by?: string
  sort_dir?: string
}

function SortHeader({
  label, column, current, dir, buildHref
}: {
  label: string
  column: SortBy
  current: SortBy
  dir: SortDir
  buildHref: (params: Record<string, string>) => string
}) {
  const isActive = current === column
  const nextDir: SortDir = isActive && dir === 'asc' ? 'desc' : 'asc'
  return (
    <th className="px-6 py-3">
      <Link
        href={buildHref({ sort_by: column, sort_dir: nextDir, page: '1' })}
        className="flex items-center gap-1 group hover:text-blue-700 transition-colors"
      >
        {label}
        <span className={`text-xs ${isActive ? 'text-blue-700' : 'text-gray-300 group-hover:text-blue-400'}`}>
          {isActive ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </Link>
    </th>
  )
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()

  const status    = (searchParams.status    ?? 'all') as BookingStatus
  const from      = searchParams.from       ?? ''
  const to        = searchParams.to         ?? ''
  const search    = searchParams.search     ?? ''
  const driverId  = searchParams.driver_id  ?? ''
  const page      = parseInt(searchParams.page ?? '1', 10)
  const offset    = (page - 1) * PAGE_SIZE
  const sortBy    = (searchParams.sort_by  ?? 'scheduled_at') as SortBy
  const sortDir   = (searchParams.sort_dir ?? 'desc') as SortDir

  // Fetch drivers for filter dropdown
  const { data: allDrivers } = await supabase
    .from('drivers')
    .select('id, first_name, last_name')
    .eq('status', 'approved')
    .order('last_name')

  let query = supabase
    .from('bookings')
    .select(
      'id, guest_name, guest_phone, pickup_address, dropoff_address, scheduled_at, base_price, estimated_min, estimated_max, status, created_at, driver_id, profiles!client_id(full_name, phone)',
      { count: 'exact' }
    )
    .order(sortBy, { ascending: sortDir === 'asc' })
    .range(offset, offset + PAGE_SIZE - 1)

  if (status !== 'all') query = query.eq('status', status)
  if (from)      query = query.gte('scheduled_at', new Date(from).toISOString())
  if (to)        query = query.lte('scheduled_at', new Date(to + 'T23:59:59').toISOString())
  if (search)    query = query.ilike('guest_name', `%${search}%`)
  if (driverId === 'unassigned') {
    query = query.is('driver_id', null)
  } else if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  const { data: bookings, count } = await query

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const buildHref = (params: Record<string, string>) => {
    const base: Record<string, string> = {
      status, from, to, search,
      driver_id: driverId,
      page: String(page),
      sort_by: sortBy,
      sort_dir: sortDir,
    }
    const merged = { ...base, ...params }
    const qs = Object.entries(merged)
      .filter(([, v]) => v && v !== 'all')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    return `/bookings${qs ? '?' + qs : ''}`
  }

  // Build driver map for display
  const driverMap: Record<string, string> = {}
  for (const d of allDrivers ?? []) {
    driverMap[d.id] = `${d.first_name} ${d.last_name}`
  }

  return (
    <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Réservations</h1>
          <p className="text-sm text-gray-500 mt-1">
            {count ?? 0} résultat{(count ?? 0) > 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <form method="GET" className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <select name="status" defaultValue={status}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Chauffeur</label>
              <select name="driver_id" defaultValue={driverId}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Tous les chauffeurs</option>
                <option value="unassigned">Non assignées</option>
                {(allDrivers ?? []).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.first_name} {d.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
              <input type="date" name="from" defaultValue={from}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
              <input type="date" name="to" defaultValue={to}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Rechercher (nom client)</label>
              <input type="text" name="search" defaultValue={search} placeholder="Nom du client..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Preserve sort params */}
            <input type="hidden" name="sort_by" value={sortBy} />
            <input type="hidden" name="sort_dir" value={sortDir} />

            <div className="flex gap-2">
              <button type="submit"
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Filtrer
              </button>
              <Link href="/bookings"
                className="text-gray-500 hover:text-gray-700 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                Réinitialiser
              </Link>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {!bookings || bookings.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              Aucune réservation trouvée
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      <SortHeader label="Date / Heure"  column="scheduled_at" current={sortBy} dir={sortDir} buildHref={buildHref} />
                      <SortHeader label="Client"        column="guest_name"   current={sortBy} dir={sortDir} buildHref={buildHref} />
                      <th className="px-6 py-3">Trajet</th>
                      <SortHeader label="Chauffeur"     column="driver_id"    current={sortBy} dir={sortDir} buildHref={buildHref} />
                      <SortHeader label="Montant"       column="base_price"   current={sortBy} dir={sortDir} buildHref={buildHref} />
                      <SortHeader label="Statut"        column="status"       current={sortBy} dir={sortDir} buildHref={buildHref} />
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking, i) => (
                      <tr key={booking.id}
                        className={`hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-900">
                            {new Date(booking.scheduled_at).toLocaleString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">
                            {(booking as any).profiles?.full_name ?? booking.guest_name ?? '—'}
                          </p>
                          {booking.guest_phone && (
                            <p className="text-xs text-gray-400">{booking.guest_phone}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-gray-900 truncate">{booking.pickup_address}</p>
                          <p className="text-xs text-gray-400 truncate">→ {booking.dropoff_address}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-xs">
                          {(booking as any).driver_id
                            ? (driverMap[(booking as any).driver_id] ?? <span className="text-gray-400">—</span>)
                            : <span className="text-orange-400">Non assigné</span>
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                          {booking.base_price != null
                            ? `${booking.base_price.toFixed(2)} €`
                            : booking.estimated_min != null
                            ? `~${booking.estimated_min}–${booking.estimated_max} €`
                            : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={booking.status} />
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/bookings/${booking.id}`}
                            className="text-blue-700 hover:text-blue-900 font-medium">
                            Voir →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-500">Page {page} sur {totalPages}</p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link href={buildHref({ page: String(page - 1) })}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        ← Précédente
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link href={buildHref({ page: String(page + 1) })}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Suivante →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </AdminLayout>
  )
}
