'use client'

import { useEffect, useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function PushSubscriber() {
  const [showBanner, setShowBanner] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return
    if (Notification.permission === 'granted') {
      subscribeSilently()
      return
    }
    if (Notification.permission === 'default') {
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

          {status === 'idle' && (
            <p className="text-xs text-blue-100 mt-0.5">Recevez les alertes de nouvelles courses en temps réel.</p>
          )}
          {status === 'loading' && (
            <p className="text-xs text-blue-100 mt-0.5">Activation en cours…</p>
          )}
          {status === 'success' && (
            <p className="text-xs text-green-200 mt-0.5">✓ Notifications activées !</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-200 mt-0.5 break-words">Erreur : {errorMsg}</p>
          )}

          {(status === 'idle' || status === 'error') && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={async () => {
                  setStatus('loading')
                  const err = await subscribe()
                  if (err) {
                    setStatus('error')
                    setErrorMsg(err)
                  } else {
                    setStatus('success')
                    setTimeout(() => setShowBanner(false), 2000)
                  }
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
          )}
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
    await saveSubscription(sub)
  } catch {
    // silent on auto-subscribe
  }
}

// Returns error string or null on success
async function subscribe(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'Permission refusée'

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
    }

    const err = await saveSubscription(sub)
    return err
  } catch (err: any) {
    return err?.message ?? 'Erreur inconnue'
  }
}

async function saveSubscription(sub: PushSubscription): Promise<string | null> {
  const json = sub.toJSON()
  if (!json.keys?.p256dh || !json.keys?.auth) return 'Clés manquantes dans la subscription'

  try {
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
      return `HTTP ${res.status} — ${body}`
    }
    return null
  } catch (err: any) {
    return err?.message ?? 'Fetch échoué'
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
