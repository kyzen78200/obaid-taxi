import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from './resend'
import { sendWebPush } from './webpush'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Mobile Push (Expo) ─────────────────────────────────────

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

// Broadcast to ALL approved drivers
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

// ── Email helpers ──────────────────────────────────────────

export async function sendEmail(to: string, subject: string, html: string) {
  if (!to) return
  await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
}

// ── Admin in-app notification ──────────────────────────────

export async function createAdminNotification(data: {
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}) {
  await supabaseAdmin.from('admin_notifications').insert(data)
}

// ── Preference-aware helpers ────────────────────────────────

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
