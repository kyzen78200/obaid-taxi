'use client'

import { useEffect, useState } from 'react'
import { subscribeForPush } from '@/lib/push-subscribe'
import { Bell } from '@/components/Icons'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function PushSubscriber() {
  const [showBanner, setShowBanner] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return
    if (Notification.permission === 'granted') {
      subscribeForPush()
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
        <Bell className="w-6 h-6 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Activer les notifications</p>

          {status === 'idle' && (
            <p className="text-xs text-blue-100 mt-0.5">Recevez les alertes de nouvelles courses en temps réel.</p>
          )}
          {status === 'loading' && (
            <p className="text-xs text-blue-100 mt-0.5">Activation en cours…</p>
          )}
          {status === 'success' && (
            <p className="text-xs text-green-200 mt-0.5">Notifications activées !</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-200 mt-0.5 break-words">Erreur : {errorMsg}</p>
          )}

          {(status === 'idle' || status === 'error') && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={async () => {
                  setStatus('loading')
                  const err = await subscribeForPush()
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
