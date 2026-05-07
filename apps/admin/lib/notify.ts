import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from './resend'
import { sendWebPush } from './webpush'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Mobile Push (Expo) ─────────────────────────────────────

/**
 * Envoie une notification push mobile à tous les appareils enregistrés d'un utilisateur
 * via l'Expo Push Service (https://exp.host/--/api/v2/push/send).
 * Appelé depuis les API routes admin lors des changements de statut de réservation.
 *
 * @param userId - ID de l'utilisateur cible (doit avoir un token dans push_tokens)
 * @param notification - Contenu de la notification (title, body, data optionnel)
 */
export async function sendMobilePush(
  userId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
) {
  const { data: tokens } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)

  if (!tokens?.length) return

  const messages = tokens.map(t => ({
    to: t.token,
    title: notification.title,
    body: notification.body,
    data: notification.data ?? {},
    sound: 'default',
  }))

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  })
}

// ── Web Push (Chauffeur) ───────────────────────────────────

/**
 * Envoie une notification Web Push VAPID à un chauffeur spécifique.
 * Nettoie automatiquement les subscriptions expirées (410 Gone) de la BDD.
 * Appelé lors de l'assignation d'une course ou d'une annulation client.
 *
 * @param driverUserId - user_id du chauffeur (clé étrangère dans web_push_subscriptions)
 * @param notification - Contenu de la notification
 */
export async function sendDriverWebPush(
  driverUserId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
) {
  const { data: subs } = await supabaseAdmin
    .from('web_push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('driver_id', driverUserId)

  if (!subs?.length) return

  for (const sub of subs) {
    const result = await sendWebPush(sub, notification)
    if (result?.expired) {
      // Clean up expired subscription
      await supabaseAdmin.from('web_push_subscriptions').delete().eq('id', sub.id)
    }
  }
}

/**
 * Diffuse une notification Web Push à tous les chauffeurs approuvés,
 * en respectant leur préférence push_new_broadcast.
 * Appelé depuis booking-created pour alerter les chauffeurs d'une nouvelle réservation.
 *
 * @param notification - Contenu de la notification à diffuser
 */
export async function broadcastWebPushToAllDrivers(
  notification: { title: string; body: string; data?: Record<string, unknown> },
) {
  const { data: approvedDrivers } = await supabaseAdmin
    .from('drivers')
    .select('user_id')
    .eq('status', 'approved')

  if (!approvedDrivers?.length) return

  // Check preferences and send
  for (const driver of approvedDrivers) {
    const { data: prefs } = await supabaseAdmin
      .from('driver_notification_preferences')
      .select('push_new_broadcast')
      .eq('driver_id', driver.user_id)
      .single()

    if (prefs && prefs.push_new_broadcast === false) continue
    await sendDriverWebPush(driver.user_id, notification)
  }
}

// ── Web Push (Admin) ───────────────────────────────────────

/**
 * Envoie une notification Web Push à tous les profils avec le rôle 'admin'.
 * Utilisé pour alerter le gestionnaire (Obaid) en temps réel d'une nouvelle réservation.
 *
 * @param notification - Contenu de la notification
 */
export async function sendAdminWebPush(
  notification: { title: string; body: string; data?: Record<string, unknown> },
) {
  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (!admins?.length) return

  for (const admin of admins) {
    const { data: subs } = await supabaseAdmin
      .from('web_push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('driver_id', admin.id)

    if (!subs?.length) continue

    for (const sub of subs) {
      const result = await sendWebPush(sub, notification)
      if (result?.expired) {
        await supabaseAdmin.from('web_push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}

// ── Email helpers ──────────────────────────────────────────

/**
 * Envoie un email transactionnel via Resend.
 * Ne fait rien si `to` est vide (évite les erreurs silencieuses avec les invités sans email).
 *
 * @param to - Adresse email destinataire
 * @param subject - Objet de l'email
 * @param html - Contenu HTML (utiliser les templates de resend.ts)
 */
export async function sendEmail(to: string, subject: string, html: string) {
  if (!to) return
  await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
}

// ── Admin in-app notification ──────────────────────────────

/**
 * Crée une notification in-app pour le gestionnaire (table admin_notifications).
 * Affichée dans AdminNotificationBell via subscription Realtime.
 *
 * @param data - Type, titre, corps et données optionnelles de la notification
 */
export async function createAdminNotification(data: {
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}) {
  await supabaseAdmin.from('admin_notifications').insert(data)
}

// ── Preference-aware helpers ────────────────────────────────

/**
 * Envoie une notification push mobile au client, en respectant sa préférence push_booking_status.
 * Appelé depuis /api/notify/booking-status lors des changements de statut confirmé/refusé.
 *
 * @param clientId - ID du client (user_id Supabase)
 * @param clientEmail - Email du client (non utilisé ici, conservé pour extension future)
 * @param notification - Contenu de la notification
 */
export async function notifyClientStatusChange(
  clientId: string,
  clientEmail: string | null,
  notification: { title: string; body: string; data?: Record<string, unknown> },
) {
  // Push
  const { data: prefs } = await supabaseAdmin
    .from('notification_preferences')
    .select('push_booking_status')
    .eq('user_id', clientId)
    .single()

  if (!prefs || prefs.push_booking_status !== false) {
    await sendMobilePush(clientId, notification)
  }
}

/**
 * Notifie le chauffeur qu'une course qui lui était assignée a été annulée.
 * Respecte la préférence push_cancelled du chauffeur.
 */
export async function notifyDriverCancelled(
  driverUserId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
) {
  const { data: prefs } = await supabaseAdmin
    .from('driver_notification_preferences')
    .select('push_cancelled')
    .eq('driver_id', driverUserId)
    .single()

  if (!prefs || prefs.push_cancelled !== false) {
    await sendDriverWebPush(driverUserId, notification)
  }
}

/**
 * Notifie le chauffeur qu'une course vient de lui être assignée par le gestionnaire.
 * Respecte la préférence push_assigned du chauffeur.
 */
export async function notifyDriverAssigned(
  driverUserId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
) {
  const { data: prefs } = await supabaseAdmin
    .from('driver_notification_preferences')
    .select('push_assigned')
    .eq('driver_id', driverUserId)
    .single()

  if (!prefs || prefs.push_assigned !== false) {
    await sendDriverWebPush(driverUserId, notification)
  }
}
