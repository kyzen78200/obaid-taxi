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
    const steps: string[] = []

    // 1. Anonymize bookings — keep guest_name/phone placeholders to satisfy
    // the booking_has_client_or_guest CHECK constraint
    const { error: e1 } = await supabaseAdmin
      .from('bookings')
      .update({ client_id: null, guest_name: 'Compte supprimé', guest_phone: '***', guest_email: null })
      .eq('client_id', userId)
    if (e1) return NextResponse.json({ error: `step1_bookings: ${e1.message}` }, { status: 500 })
    steps.push('bookings anonymized')

    // 2. Delete notification preferences
    const { error: e2 } = await supabaseAdmin
      .from('notification_preferences')
      .delete()
      .eq('user_id', userId)
    if (e2) return NextResponse.json({ error: `step2_notif_prefs: ${e2.message}` }, { status: 500 })
    steps.push('notification_preferences deleted')

    // 3. Delete push tokens
    const { error: e3 } = await supabaseAdmin
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
    if (e3) return NextResponse.json({ error: `step3_push_tokens: ${e3.message}` }, { status: 500 })
    steps.push('push_tokens deleted')

    // 4. Delete loyalty transactions
    const { error: e4 } = await supabaseAdmin
      .from('loyalty_transactions')
      .delete()
      .eq('client_id', userId)
    if (e4) return NextResponse.json({ error: `step4_loyalty: ${e4.message}` }, { status: 500 })
    steps.push('loyalty_transactions deleted')

    // 5. Delete profile
    const { error: e5 } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (e5) return NextResponse.json({ error: `step5_profile: ${e5.message}` }, { status: 500 })
    steps.push('profile deleted')

    // 6. Delete auth user
    const { error: e6 } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (e6) return NextResponse.json({ error: `step6_auth: ${e6.message}`, steps }, { status: 500 })
    steps.push('auth user deleted')

    return NextResponse.json({ success: true, steps })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
