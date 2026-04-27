import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireBearerAuth } from '@/lib/api-auth'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireBearerAuth(req)
    if (error) return error

    const userId = user!.id

    // Anonymize bookings — placeholders satisfy the booking_has_client_or_guest
    // CHECK constraint (client_id IS NOT NULL OR guest_name+guest_phone NOT NULL)
    const { error: e1 } = await supabaseAdmin
      .from('bookings')
      .update({ client_id: null, guest_name: 'Compte supprimé', guest_phone: '***', guest_email: null })
      .eq('client_id', userId)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    const { error: e2 } = await supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    const { error: e3 } = await supabaseAdmin.from('push_tokens').delete().eq('user_id', userId)
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })

    const { error: e4 } = await supabaseAdmin.from('loyalty_transactions').delete().eq('client_id', userId)
    if (e4) return NextResponse.json({ error: e4.message }, { status: 500 })

    const { error: e5 } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
    if (e5) return NextResponse.json({ error: e5.message }, { status: 500 })

    // Final irreversible step
    const { error: e6 } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (e6) return NextResponse.json({ error: e6.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
