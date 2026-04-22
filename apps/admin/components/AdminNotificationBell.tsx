'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Inbox, XCircle, AlertTriangle, Bell, User, Clock } from 'lucide-react'

type AdminNotif = {
  id: string
  type: string
  title: string
  body: string
  data: any
  read: boolean
  created_at: string
}

const TYPE_ICON_MAP: Record<string, React.ReactNode> = {
  new_booking: <Inbox className="w-5 h-5 text-blue-600" />,
  booking_cancelled: <XCircle className="w-5 h-5 text-red-500" />,
  unassigned_urgent: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  no_show: <AlertTriangle className="w-5 h-5 text-red-600" />,
  new_driver: <User className="w-5 h-5 text-gray-600" />,
  broadcast_timeout: <Clock className="w-5 h-5 text-gray-500" />,
}

export default function AdminNotificationBell() {
  const supabase = createClient()
  const [notifs, setNotifs] = useState<AdminNotif[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifs.filter(n => !n.read).length

  useEffect(() => {
    loadNotifs()

    // Realtime subscription — unique name avoids React Strict Mode double-mount conflict
    const channelName = `admin-notifs-${Date.now()}`
    const channel = supabase.channel(channelName)
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, payload => {
        setNotifs(prev => [payload.new as AdminNotif, ...prev].slice(0, 20))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadNotifs() {
    const { data } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs(data ?? [])
  }

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id)
    if (!unreadIds.length) return
    await supabase.from('admin_notifications').update({ read: true }).in('id', unreadIds)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function markRead(id: string) {
    await supabase.from('admin_notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function getLink(notif: AdminNotif): string {
    const data = notif.data ?? {}
    if (data.bookingId) return `/bookings/${data.bookingId}`
    if (data.driverUserId) return `/drivers`
    return '/dashboard'
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'à l\'instant'
    if (mins < 60) return `il y a ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `il y a ${hrs}h`
    return `il y a ${Math.floor(hrs / 24)}j`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); if (!open && unreadCount > 0) markAllRead() }}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 left-4 md:left-64 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucune notification</p>
            ) : (
              notifs.map(notif => (
                <Link
                  key={notif.id}
                  href={getLink(notif)}
                  onClick={() => { markRead(notif.id); setOpen(false) }}
                  className={`flex gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors ${!notif.read ? 'bg-blue-50' : ''}`}
                >
                  <span className="flex-shrink-0 mt-0.5">{TYPE_ICON_MAP[notif.type] ?? <Bell className="w-5 h-5 text-gray-500" />}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-gray-900 truncate ${!notif.read ? 'font-semibold' : ''}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{notif.body}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(notif.created_at)}</p>
                  </div>
                  {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
