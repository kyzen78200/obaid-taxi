import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export interface PushSubscription {
  endpoint: string
  p256dh: string
  auth_key: string
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  data?: Record<string, unknown>
}

export async function sendWebPush(sub: PushSubscription, payload: PushPayload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload),
    )
  } catch (err: any) {
    // 410 Gone = subscription expired → caller should delete it
    if (err?.statusCode === 410) {
      return { expired: true }
    }
    console.error('Web push error:', err?.message)
  }
  return { expired: false }
}
