import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/AdminLayout'
import Link from 'next/link'
import { User, Users, Star, AlertTriangle } from 'lucide-react'

const PAGE_SIZE = 30

interface SearchParams {
  search?: string
  page?: string
  type?: string
}

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()

  const search  = searchParams.search ?? ''
  const type    = searchParams.type   ?? 'all'   // 'all' | 'registered' | 'guest'
  const page    = parseInt(searchParams.page ?? '1', 10)
  const offset  = (page - 1) * PAGE_SIZE

  // ── Registered clients (have a profile + auth account, not admin/driver) ──
  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, phone, loyalty_points, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (search) {
    profilesQuery = profilesQuery.ilike('full_name', `%${search}%`)
  }

  // ── Guest clients (bookings with no client_id, unique by phone) ──
  let guestQuery = supabase
    .from('bookings')
    .select('guest_name, guest_phone, guest_email, created_at')
    .is('client_id', null)
    .not('guest_phone', 'is', null)
    .order('created_at', { ascending: false })

  if (search) {
    guestQuery = guestQuery.ilike('guest_name', `%${search}%`)
  }

  const [{ data: profiles, count: profileCount }, { data: guestBookings }] = await Promise.all([
    profilesQuery,
    guestQuery,
  ])

  // Deduplicate guests by phone number
  const seenPhones = new Set<string>()
  const guests: { name: string; phone: string; email: string | null; created_at: string }[] = []
  for (const b of guestBookings ?? []) {
    if (b.guest_phone && !seenPhones.has(b.guest_phone)) {
      seenPhones.add(b.guest_phone)
      guests.push({
        name: b.guest_name ?? 'Invité',
        phone: b.guest_phone,
        email: b.guest_email ?? null,
        created_at: b.created_at,
      })
    }
  }

  const totalRegistered = profileCount ?? 0
  const totalGuests = guests.length

  // ── No-show counts for registered clients ──
  const profileIds = (profiles ?? []).map(p => p.id)
  let noShowMap: Record<string, number> = {}
  if (profileIds.length > 0) {
    const { data: noShows } = await supabase
      .from('bookings')
      .select('client_id')
      .in('client_id', profileIds)
      .eq('status', 'no_show')
    for (const ns of noShows ?? []) {
      if (ns.client_id) noShowMap[ns.client_id] = (noShowMap[ns.client_id] ?? 0) + 1
    }
  }

  // ── No-show counts for guest phones ──
  const guestPhones = guests.map(g => g.phone)
  let guestNoShowMap: Record<string, number> = {}
  if (guestPhones.length > 0) {
    const { data: guestNoShows } = await supabase
      .from('bookings')
      .select('guest_phone')
      .in('guest_phone', guestPhones)
      .eq('status', 'no_show')
    for (const ns of guestNoShows ?? []) {
      if (ns.guest_phone) guestNoShowMap[ns.guest_phone] = (guestNoShowMap[ns.guest_phone] ?? 0) + 1
    }
  }

  // ── CSV export helper (inline) ──
  const buildCsvHref = (t: string) => {
    const qs = new URLSearchParams({ ...(search ? { search } : {}), type: t, export: 'csv' }).toString()
    return `/clients/export?${qs}`
  }

  return (
    <AdminLayout>
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalRegistered} compte{totalRegistered > 1 ? 's' : ''} enregistré{totalRegistered > 1 ? 's' : ''} · {totalGuests} invité{totalGuests > 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href={buildCsvHref(type)}
            className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            ↓ Exporter CSV
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <form method="GET" className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Rechercher</label>
              <input type="text" name="search" defaultValue={search}
                placeholder="Nom du client..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select name="type" defaultValue={type}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">Tous les clients</option>
                <option value="registered">Comptes enregistrés</option>
                <option value="guest">Invités uniquement</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Filtrer
              </button>
              <Link href="/clients" className="text-gray-500 hover:text-gray-700 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                Réinitialiser
              </Link>
            </div>
          </form>
        </div>

        <div className="space-y-6">

          {/* ── Registered clients ── */}
          {type !== 'guest' && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">Comptes enregistrés</h2>
                </div>
                <span className="text-sm text-gray-400">{totalRegistered}</span>
              </div>

              {!profiles || profiles.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">Aucun client enregistré</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3">Nom</th>
                      <th className="px-6 py-3">Téléphone</th>
                      <th className="px-6 py-3">Points</th>
                      <th className="px-6 py-3">Inscrit le</th>
                      <th className="px-6 py-3">Alertes</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((client, i) => {
                      const noShowCount = noShowMap[client.id] ?? 0
                      return (
                        <tr key={client.id} className={`hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-6 py-4 font-medium text-gray-900">{client.full_name ?? '—'}</td>
                          <td className="px-6 py-4 text-gray-600">{client.phone ?? '—'}</td>
                          <td className="px-6 py-4">
                            <span className="text-yellow-700 font-medium flex items-center gap-1"><Star className="w-3.5 h-3.5" /> {client.loyalty_points ?? 0}</span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs">
                            {new Date(client.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-6 py-4">
                            {noShowCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3" /> {noShowCount} no-show
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Link href={`/clients/${client.id}`} className="text-blue-700 hover:text-blue-900 font-medium text-sm">
                              Voir →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}

          {/* ── Guest clients ── */}
          {type !== 'registered' && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-900">Clients invités</h2>
                </div>
                <span className="text-sm text-gray-400">{totalGuests}</span>
              </div>

              {guests.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">Aucun client invité</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3">Nom</th>
                      <th className="px-6 py-3">Téléphone</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Alertes</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.map((guest, i) => {
                      const noShowCount = guestNoShowMap[guest.phone] ?? 0
                      return (
                        <tr key={guest.phone} className={`hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-6 py-4 font-medium text-gray-900">{guest.name}</td>
                          <td className="px-6 py-4 text-gray-600">{guest.phone}</td>
                          <td className="px-6 py-4 text-gray-500">{guest.email ?? '—'}</td>
                          <td className="px-6 py-4">
                            {noShowCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3" /> {noShowCount} no-show
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Link href={`/clients/guest?phone=${encodeURIComponent(guest.phone)}`} className="text-blue-700 hover:text-blue-900 font-medium text-sm">
                              Voir →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}
        </div>
    </AdminLayout>
  )
}
