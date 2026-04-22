'use client'

import { useEffect, useState } from 'react'
import { subscribeForPush } from '@/lib/push-subscribe'

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export default function NotificationPermissionButton() {
  const [permission, setPermission] = useState<PermissionState>('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)
  }, [])

  async function handleActivate() {
    setLoading(true)
    setError('')
    const err = await subscribeForPush()
    if (err) {
      setError(err)
    } else {
      setPermission('granted')
    }
    setLoading(false)
  }

  if (permission === 'unsupported') {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm text-gray-700">Notifications push</p>
          <p className="text-xs text-gray-400 mt-0.5">Non supporté sur ce navigateur</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Indisponible</span>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm text-gray-700">Notifications push</p>
          <p className="text-xs text-red-500 mt-0.5">
            Bloquées — allez dans Réglages iOS → Apps → Safari → Notifications pour les réactiver
          </p>
        </div>
        <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full flex-shrink-0">Bloquées</span>
      </div>
    )
  }

  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm text-gray-700">Notifications push</p>
          <p className="text-xs text-green-600 mt-0.5">Activées sur cet appareil</p>
        </div>
        <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">Activées</span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100">
      <div className="flex-1">
        <p className="text-sm text-gray-700">Notifications push</p>
        <p className="text-xs text-gray-400 mt-0.5">Recevez les alertes en temps réel sur cet appareil</p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <button
        onClick={handleActivate}
        disabled={loading}
        className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
      >
        {loading ? '…' : 'Activer'}
      </button>
    </div>
  )
}
