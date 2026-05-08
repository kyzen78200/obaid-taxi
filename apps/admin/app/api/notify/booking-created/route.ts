// Called by the mobile app after creating a booking
// Sends email confirmation to the client + admin notification
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { bookingConfirmedHtml } from '@/lib/resend'
import { createAdminNotification, sendAdminWebPush, sendEmail } from '@/lib/notify'
import { requireBearerAuth } from '@/lib/api-auth'
import { rateLimit, getIp } from '@/lib/rate-limit'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Secret partagé pour les réservations invités (sans JWT)
const BOOKING_NOTIFY_SECRET = process.env.BOOKING_NOTIFY_SECRET

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting : 20 req/min/IP pour prévenir les abus
    const ip = getIp(req)
    const rl = rateLimit(`booking-notify:${ip}`, 20, 60 * 1000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans un moment.' },
        { status: 429, headers: CORS_HEADERS },
      )
    }

    const { bookingId } = await req.json()
    if (!bookingId) return NextResponse.json({ error: 'bookingId requis' }, { status: 400, headers: CORS_HEADERS })

    const authHeader = req.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      // Utilisateur connecté — vérifier via JWT
      const { user, error } = await requireBearerAuth(req)
      if (error) return NextResponse.json({ error: 'Token invalide' }, { status: 401, headers: CORS_HEADERS })
      userId = user?.id ?? null
    } else if (authHeader?.startsWith('Secret ')) {
      // Réservation invité — vérifier le secret partagé
      const secret = authHeader.slice(7)
      if (!BOOKING_NOTIFY_SECRET || secret !== BOOKING_NOTIFY_SECRET) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401, headers: CORS_HEADERS })
      }
      // userId reste null pour les invités
    } else {
      // Aucune auth fournie — refuser
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401, headers: CORS_HEADERS })
    }

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, profiles!client_id(full_name, email)')
      .eq('id', bookingId)
      .single()

    if (!booking) return NextResponse.json({ error: 'Course introuvable' }, { status: 404, headers: CORS_HEADERS })

    // Si utilisateur connecté, vérifier la propriété
    if (userId && booking.client_id && booking.client_id !== userId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: CORS_HEADERS })
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
          'Votre réservation O Taxi est confirmée',
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
    const notifTitle = 'Nouvelle réservation'
    const notifBody = `${clientName} — ${booking.pickup_address} → ${booking.dropoff_address}`
    await createAdminNotification({
      type: 'new_booking',
      title: notifTitle,
      body: notifBody,
      data: { bookingId },
    })

    // Notif push web admin (iPhone via PWA)
    await sendAdminWebPush({
      title: notifTitle,
      body: notifBody,
      data: { bookingId, url: `/bookings/${bookingId}` },
    })

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500, headers: CORS_HEADERS })
  }
}
