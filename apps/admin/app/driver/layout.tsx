'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import DarkModeToggle from '@/components/DarkModeToggle'
import PushSubscriber from '@/components/PushSubscriber'
import { Car, Search, Calendar, Settings } from '@/components/Icons'

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [driver, setDriver] = useState<{ first_name: string; last_name: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('drivers')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single()
      if (data) setDriver(data)
    }
    load()
  }, [])

  const navLinks = [
    { href: '/driver',          label: 'Mes courses', icon: <Car className="w-5 h-5" /> },
    { href: '/driver/search',   label: 'Chercher',    icon: <Search className="w-5 h-5" /> },
    { href: '/driver/calendar', label: 'Agenda',      icon: <Calendar className="w-5 h-5" /> },
    { href: '/driver/settings', label: 'Paramètres',  icon: <Settings className="w-5 h-5" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PushSubscriber />
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/icon-192.png" className="w-7 h-7 rounded-lg" alt="O Taxi" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">O Taxi</p>
            {driver && (
              <p className="text-xs text-gray-500 leading-tight">
                {driver.first_name} {driver.last_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DarkModeToggle compact />
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/driver-login') }}
            className="text-sm text-gray-400 hover:text-gray-700 font-medium transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10 flex">
        {navLinks.map(link => {
          const isActive = link.href === '/driver'
            ? pathname === '/driver'
            : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="leading-none">{link.icon}</span>
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                {link.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Page content */}
      <main className="flex-1 pb-20">
        {children}
      </main>
    </div>
  )
}
