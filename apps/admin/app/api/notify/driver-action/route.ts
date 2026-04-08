// Called by the driver app after updating a booking status
// Triggers admin in-app notifications + client push notifications
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminNotification, notifyClientStatusChange, sendEmail } from '@/lib/notify'
import { bookingRecapHtml } from '@/lib/resend'
import { requireDriver } from '@/lib/api-auth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALLOWED_STATUSES = ['in_progress', 'completed', 'no_show', 'cancellation_requested']

export async function POST(req: NextRequest) {
  try {
    // Verify caller is an authenticated approved driver
    const { driver, error: authError } = await requireDriver()
    if (authError) return authError

    const { bookingId, newStatus } = await req.json()
    if (!bookingId || !newStatus) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // Validate status value
    if (!ALLOWED_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // Verify the booking belongs to this driver
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, profiles!client_id(full_name, email)')
      .eq('id', bookingId)
      .eq('driver_id', driver!.id)
      .single()

    if (!booking) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })

    const clientName = booking.profiles?.full_name ?? booking.guest_name ?? 'Client'
    const clientEmail = booking.profiles?.email ?? booking.guest_email

    // ── Admin in-app notifications ─────────────────────────────

    if (newStatus === 'no_show') {
      await createAdminNotification({
        type: 'no_show',
        title: '🚨 No-show signalé',
        body: `${clientName} — ${booking.pickup_address}`,
        data: { bookingId },
      })
    }

    if (newStatus === 'cancellation_requested') {
      await createAdminNotification({
        type: 'booking_cancelled',
        title: '⚠️ Annulation demandée par le chauffeur',
        body: `${clientName} — ${booking.pickup_address} → ${booking.dropoff_address}`,
        data: { bookingId },
      })
    }

    // ── Client push notifications ──────────────────────────────

    const statusLabels: Record<string, string> = {
      in_progress: '🚕 Votre chauffeur est en route',
      completed:   '✅ Course terminée',
      no_show:     '⚠️ No-show enregistré par le chauffeur',
    }

    const label = statusLabels[newStatus]
    if (label && booking.client_id) {
      await notifyClientStatusChange(booking.client_id, clientEmail ?? null, {
        title: label,
        body: `${booking.pickup_address} → ${booking.dropoff_address}`,
        data: { bookingId, screen: 'booking' },
      })
    }

    // ── Email recap après complétion ───────────────────────────

    if (newStatus === 'completed' && clientEmail && booking.client_id) {
      const { data: prefs } = await supabaseAdmin
        .from('notification_preferences')
        .select('email_booking_recap')
        .eq('user_id', booking.client_id)
        .maybeSingle()

      if (!prefs || prefs.email_booking_recap !== false) {
        await sendEmail(
          clientEmail,
          'Récapitulatif de votre course Obaid Taxi',
          bookingRecapHtml({
            clientName,
            pickup: booking.pickup_address,
            dropoff: booking.dropoff_address,
            completedAt: format(new Date(), "d MMMM yyyy 'à' HH'h'mm", { locale: fr }),
            price: `${booking.base_price ?? 0}€`,
            pointsEarned: booking.points_credited ?? undefined,
          }),
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
