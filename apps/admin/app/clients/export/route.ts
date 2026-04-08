import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = req.nextUrl
  const type   = searchParams.get('type') ?? 'all'
  const search = searchParams.get('search') ?? ''

  const rows: string[][] = []
  const headers = ['Type', 'Nom', 'Téléphone', 'Email', 'Points fidélité', 'No-shows', 'Inscrit le']
  rows.push(headers)

  // Registered clients
  if (type !== 'guest') {
    let q = supabase.from('profiles').select('id, full_name, phone, loyalty_points, created_at').order('created_at', { ascending: false })
    if (search) q = q.ilike('full_name', `%${search}%`)
    const { data: profiles } = await q

    if (profiles) {
      const profileIds = profiles.map(p => p.id)
      let noShowMap: Record<string, number> = {}
      if (profileIds.length > 0) {
        const { data: noShows } = await supabase.from('bookings').select('client_id').in('client_id', profileIds).eq('status', 'no_show')
        for (const ns of noShows ?? []) {
          if (ns.client_id) noShowMap[ns.client_id] = (noShowMap[ns.client_id] ?? 0) + 1
        }
      }
      for (const p of profiles) {
        rows.push([
          'Enregistré',
          p.full_name ?? '',
          p.phone ?? '',
          '', // email not in profiles table directly
          String(p.loyalty_points ?? 0),
          String(noShowMap[p.id] ?? 0),
          new Date(p.created_at).toLocaleDateString('fr-FR'),
        ])
      }
    }
  }

  // Guest clients
  if (type !== 'registered') {
    let q = supabase.from('bookings').select('guest_name, guest_phone, guest_email, created_at').is('client_id', null).not('guest_phone', 'is', null).order('created_at', { ascending: false })
    if (search) q = q.ilike('guest_name', `%${search}%`)
    const { data: guestBookings } = await q

    const seenPhones = new Set<string>()
    const guests: { name: string; phone: string; email: string | null; created_at: string }[] = []
    for (const b of guestBookings ?? []) {
      if (b.guest_phone && !seenPhones.has(b.guest_phone)) {
        seenPhones.add(b.guest_phone)
        guests.push({ name: b.guest_name ?? 'Invité', phone: b.guest_phone, email: b.guest_email ?? null, created_at: b.created_at })
      }
    }

    const phones = guests.map(g => g.phone)
    let guestNoShowMap: Record<string, number> = {}
    if (phones.length > 0) {
      const { data: noShows } = await supabase.from('bookings').select('guest_phone').in('guest_phone', phones).eq('status', 'no_show')
      for (const ns of noShows ?? []) {
        if (ns.guest_phone) guestNoShowMap[ns.guest_phone] = (guestNoShowMap[ns.guest_phone] ?? 0) + 1
      }
    }

    for (const g of guests) {
      rows.push([
        'Invité',
        g.name,
        g.phone,
        g.email ?? '',
        '0',
        String(guestNoShowMap[g.phone] ?? 0),
        new Date(g.created_at).toLocaleDateString('fr-FR'),
      ])
    }
  }

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const filename = `clients_${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
