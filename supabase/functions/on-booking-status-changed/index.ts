// Supabase Edge Function (Deno)
// Déclenchée par un Database Webhook sur UPDATE de la table `bookings`

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const STATUS_MESSAGES: Record<string, { subject: string; body: string }> = {
  confirmed: {
    subject: '✅ Votre course est confirmée — Obaid Taxi',
    body: 'Bonne nouvelle ! Votre course a été confirmée. Le chauffeur sera à l\'heure.',
  },
  refused: {
    subject: '❌ Course non disponible — Obaid Taxi',
    body: 'Nous sommes désolés, votre course n\'a pas pu être prise en charge. N\'hésitez pas à réserver à nouveau.',
  },
  cancelled: {
    subject: '🚫 Course annulée — Obaid Taxi',
    body: 'Votre course a été annulée.',
  },
  completed: {
    subject: '⭐ Course effectuée — Obaid Taxi',
    body: 'Merci d\'avoir choisi Obaid Taxi ! Nous espérons vous revoir très bientôt.',
  },
}

serve(async (req) => {
  try {
    const body = await req.json()
    const { record: booking, old_record: oldBooking } = body

    // Ne traiter que les vrais changements de statut
    if (booking.status === oldBooking?.status) {
      return new Response('No status change', { status: 200 })
    }

    // ── Créditer les points fidélité si course effectuée ──────────────────
    if (booking.status === 'completed' && booking.client_id) {
      const points = Math.round(booking.distance_km)

      if (points > 0) {
        await supabase.rpc('credit_loyalty_points', {
          p_client_id: booking.client_id,
          p_booking_id: booking.id,
          p_points: points,
        })

        await supabase
          .from('bookings')
          .update({ points_credited: points })
          .eq('id', booking.id)
      }
    }

    // ── Envoyer notification push ─────────────────────────────────────────
    const pushTarget = booking.client_id
      ? await getPushToken(booking.client_id)
      : null

    if (pushTarget && STATUS_MESSAGES[booking.status]) {
      await sendPushNotification(pushTarget, booking.status, booking.id)
    }

    // ── Envoyer email ─────────────────────────────────────────────────────
    const email = booking.guest_email ?? await getClientEmail(booking.client_id)

    if (email && STATUS_MESSAGES[booking.status]) {
      await sendEmail(email, booking.status)
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Error:', err)
    return new Response('Error', { status: 500 })
  }
})

async function getPushToken(clientId: string): Promise<string | null> {
  const { data } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', clientId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  return data?.token ?? null
}

async function getClientEmail(clientId: string | null): Promise<string | null> {
  if (!clientId) return null
  const { data } = await supabase.auth.admin.getUserById(clientId)
  return data.user?.email ?? null
}

async function sendPushNotification(token: string, status: string, bookingId: string) {
  const messages: Record<string, { title: string; body: string }> = {
    confirmed: { title: '✅ Course confirmée', body: 'Votre chauffeur sera là à l\'heure !' },
    refused: { title: '❌ Course non disponible', body: 'Votre demande n\'a pas pu être acceptée.' },
    completed: { title: '⭐ Merci !', body: 'Course effectuée. Points crédités !' },
    cancelled: { title: '🚫 Course annulée', body: 'Votre réservation a été annulée.' },
  }

  const msg = messages[status]
  if (!msg) return

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: msg.title,
      body: msg.body,
      data: { bookingId },
      sound: 'default',
    }),
  })
}

async function sendEmail(email: string, status: string) {
  const template = STATUS_MESSAGES[status]
  if (!template) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Obaid Taxi <noreply@obaidtaxi.fr>',
      to: [email],
      subject: template.subject,
      html: `<p>${template.body}</p>`,
    }),
  })
}
