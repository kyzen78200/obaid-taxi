// NOTE : ce fichier est intentionnellement dupliqué dans apps/admin et apps/drivers.
// Il utilise des APIs browser (navigator.serviceWorker, PushManager, window) incompatibles
// avec React Native — impossible de le placer dans packages/shared sans casser le build mobile.
// À consolider dans un packages/web-utils lors de la migration Yarn workspaces.
export async function subscribeForPush(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'Notifications non supportées sur ce navigateur'
  }
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return 'Clé VAPID manquante'
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'Permission refusée'

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
    }

    const json = sub.toJSON()
    if (!json.keys?.p256dh || !json.keys?.auth) return 'Clés manquantes dans la subscription'

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return `Erreur serveur ${res.status} — ${body}`
    }

    return null
  } catch (err: any) {
    return err?.message ?? 'Erreur inconnue'
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
