// Called by admin drivers page when approving or revoking a driver
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendDriverWebPush } from '@/lib/notify'
import { driverApprovedHtml } from '@/lib/resend'
import { sendEmail } from '@/lib/notify'
import { requireAdmin } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    // Only admins can change driver status
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { driverId, newStatus } = await req.json()
    if (!driverId || !newStatus) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    if (!['approved', 'revoked'].includes(newStatus)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('user_id, first_name, last_name, email:user_id(email)')
      .eq('id', driverId)
      .single()

    if (!driver) return NextResponse.json({ error: 'Chauffeur introuvable' }, { status: 404 })

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(driver.user_id)
    const driverEmail = authUser.user?.email

    const { data: prefs } = await supabaseAdmin
      .from('driver_notification_preferences')
      .select('push_account_status, email_account_approved')
      .eq('driver_id', driver.user_id)
      .maybeSingle()

    if (newStatus === 'approved') {
      if (!prefs || prefs.push_account_status !== false) {
        await sendDriverWebPush(driver.user_id, {
          title: '✅ Compte approuvé !',
          body: 'Vous pouvez maintenant accepter des courses. Bonne route !',
          data: { url: '/driver' },
        })
      }
      if (driverEmail && (!prefs || prefs.email_account_approved !== false)) {
        await sendEmail(
          driverEmail,
          'Votre compte chauffeur Obaid Taxi est approuvé',
          driverApprovedHtml({ firstName: driver.first_name }),
        )
      }
    } else if (newStatus === 'revoked') {
      if (!prefs || prefs.push_account_status !== false) {
        await sendDriverWebPush(driver.user_id, {
          title: '🚫 Compte révoqué',
          body: "Votre accès a été suspendu. Contactez l'administrateur.",
          data: { url: '/driver-login' },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
