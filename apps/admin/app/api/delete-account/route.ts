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

    // Anonymize bookings — keep records for business, remove personal data
    await supabaseAdmin
      .from('bookings')
      .update({
        client_id: null,
        guest_name: null,
        guest_phone: null,
        guest_email: null,
      })
      .eq('client_id', user!.id)

    // Delete auth user — cascades automatically to profiles, loyalty_transactions,
    // push_tokens, notification_preferences via ON DELETE CASCADE
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user!.id)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
