'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function Header() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{ full_name: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase.from('profiles').select('full_name').eq('id', user.id).single()
          .then(({ data }) => { if (data) setProfile(data) })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <img src="/icon-192.png" className="w-8 h-8 rounded-lg" alt="O Taxi" />
        <span className="font-bold text-gray-900">O Taxi</span>
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/history" className="text-gray-600 hover:text-gray-900 transition-colors">
          Mes réservations
        </Link>
        {user ? (
          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-blue-700 font-medium hover:text-blue-800 transition-colors">
              {profile?.full_name?.split(' ')[0] ?? 'Mon compte'}
            </Link>
            <button onClick={handleSignOut} className="text-gray-400 hover:text-gray-600 text-xs">
              Déconnexion
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-blue-700 font-medium hover:text-blue-800 transition-colors">
            Connexion
          </Link>
        )}
      </div>
    </header>
  )
}
