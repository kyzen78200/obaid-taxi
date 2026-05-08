// Supabase Edge Function (Deno)
// Déclenchée par un Database Webhook sur UPDATE de la table `bookings`

import { serve } from 'jsr:@std/http/server'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Secret partagé configuré dans les secrets Supabase Edge Functions
// Doit correspondre à la valeur du webhook Supabase (dashboard → Webhooks → signing secret)
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SIGNING_SECRET')

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

/**
 * Vérifie la signature HMAC-SHA256 du webhook Supabase.
 * Protège contre la forge de payload (points de fidélité, emails frauduleux).
 * @see https://supabase.com/docs/guides/functions/webhook-verification
 */
async function verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) {
    // Si le secret n'est pas configuré, passer en mode permissif (dev uniquement)
    console.warn('[webhook] WEBHOOK_SIGNING_SECRET non défini — vérification de signature ignorée')
    return true
  }

  const signature = req.headers.get('x-supabase-webhook-signature')
  if (!signature) {
    console.error('[webhook] Signature manquante dans les headers')
    return false
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  // Comparaison résistante aux timing attacks
  const expected = `sha256=${expectedSignature}`
  if (expected.length !== signature.length) return false

  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

serve(async (req) => {
  try {
    const rawBody = await req.text()

    // Vérifier la signature HMAC avant tout traitement
    const isValid = await verifyWebhookSignature(req, rawBody)
    if (!isValid) {
      console.error('[webhook] Signature invalide — requête rejetée')
      return new Response('Unauthorized', { status: 401 })
    }

    const body = JSON.parse(rawBody)
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
