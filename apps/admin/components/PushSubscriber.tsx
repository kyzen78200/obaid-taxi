'use client'

import { useEffect, useState } from 'react'

export default function PushSubscriber() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return
    if (Notification.permission === 'granted') {
      subscribeSilently()
      return
    }
    if (Notification.permission === 'default') {
      // iOS requires a user gesture — show a banner to tap
      setShowBanner(true)
    }
  }, [])

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80">
      <div className="bg-blue-600 text-white rounded-xl shadow-lg p-4 flex items-start gap-3">
        <span className="text-2xl mt-0.5">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Activer les notifications</p>
          <p className="text-xs text-blue-100 mt-0.5">Recevez les alertes de nouvelles courses en temps réel.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => {
                setShowBanner(false)
                await subscribe()
              }}
              className="bg-white text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Activer
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="text-blue-200 text-xs px-3 py-1.5 hover:text-white transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

async function subscribeSilently() {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
    }
    // Always re-save to ensure the DB is in sync
    await saveSubscription(sub)
  } catch {
    // silent
  }
}

async function subscribe() {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    await subscribeSilently()
  } catch (err) {
    console.warn('Push subscription failed:', err)
  }
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  if (!json.keys?.p256dh || !json.keys?.auth) return
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }),
  })
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
