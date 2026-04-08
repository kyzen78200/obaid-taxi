import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  const { data: drivers } = await supabase
    .from('drivers')
    .select('first_name, last_name, phone, status, created_at')
    .order('created_at', { ascending: false })

  const headers = ['Prénom', 'Nom', 'Téléphone', 'Statut', 'Inscrit le']
  const rows = [
    headers,
    ...(drivers ?? []).map(d => [
      d.first_name,
      d.last_name,
      d.phone ?? '',
      d.status,
      new Date(d.created_at).toLocaleDateString('fr-FR'),
    ]),
  ]

  const csv = rows
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const filename = `chauffeurs_${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
