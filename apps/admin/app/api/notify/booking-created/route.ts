// Called by the mobile app after creating a booking
// Sends email confirmation to the client + admin notification
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { bookingConfirmedHtml } from '@/lib/resend'
import { createAdminNotification, sendEmail } from '@/lib/notify'
import { requireBearerAuth } from '@/lib/api-auth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is an authenticated mobile user
    const { user, error: authError } = await requireBearerAuth(req)
    if (authError) return authError

    const { bookingId } = await req.json()
    if (!bookingId) return NextResponse.json({ error: 'bookingId requis' }, { status: 400 })

    // Verify the booking belongs to this user (or is a guest booking they just created)
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, profiles!client_id(full_name, email)')
      .eq('id', bookingId)
      .single()

    if (!booking) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })

    // Ensure the booking belongs to the authenticated user
    if (booking.client_id && booking.client_id !== user!.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const clientName = booking.profiles?.full_name ?? booking.guest_name ?? 'Client'
    const clientEmail = booking.profiles?.email ?? booking.guest_email

    // Email confirmation au client
    if (clientEmail) {
      const { data: prefs } = await supabaseAdmin
        .from('notification_preferences')
        .select('email_booking_confirmed')
        .eq('user_id', booking.client_id)
        .maybeSingle()

      if (!prefs || prefs.email_booking_confirmed !== false) {
        const scheduledAt = format(
          new Date(booking.scheduled_at),
          "EEEE d MMMM 'à' HH'h'mm",
          { locale: fr },
        )
        const estimatedPrice = booking.estimated_min && booking.estimated_max
          ? `${booking.estimated_min}€ – ${booking.estimated_max}€`
          : `${booking.base_price}€`

        await sendEmail(
          clientEmail,
          'Votre réservation Obaid Taxi est confirmée',
          bookingConfirmedHtml({
            clientName,
            pickup: booking.pickup_address,
            dropoff: booking.dropoff_address,
            scheduledAt,
            estimatedPrice,
            bookingId,
          }),
        )
      }
    }

    // Notif in-app admin
    await createAdminNotification({
      type: 'new_booking',
      title: 'Nouvelle réservation',
      body: `${clientName} — ${booking.pickup_address} → ${booking.dropoff_address}`,
      data: { bookingId },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
