'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface LoyaltyTx {
  id: string
  type: 'earned' | 'spent'
  points: number
  bookings?: { pickup_address: string; dropoff_address: string } | null
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null; loyalty_points: number } | null>(null)
  const [loyaltyTxs, setLoyaltyTxs] = useState<LoyaltyTx[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, loyalty_points')
          .eq('id', user.id)
          .single()
        if (data) setProfile(data)

        const { data: txs } = await supabase
          .from('loyalty_transactions')
          .select('id, type, points, bookings(pickup_address, dropoff_address)')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
        if (txs) setLoyaltyTxs(txs as unknown as LoyaltyTx[])
      }

      setLoading(false)
    }
    load()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <p className="text-lg font-bold text-gray-900 mb-2">Pas encore de compte</p>
        <p className="text-sm text-gray-500 mb-6">
          Créez un compte pour accéder à votre profil, votre historique et vos points fidélité
        </p>
        <Link
          href="/register"
          className="w-full max-w-xs bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm text-center hover:bg-blue-800 transition-colors mb-3"
        >
          Créer un compte
        </Link>
        <Link
          href="/login"
          className="w-full max-w-xs bg-white border border-gray-200 text-gray-700 font-medium py-3 rounded-xl text-sm text-center hover:bg-gray-50 transition-colors"
        >
          Se connecter
        </Link>
      </div>
    )
  }

  const initial = profile?.full_name?.charAt(0).toUpperCase() ?? user.email?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

      {/* Avatar + name */}
      <div className="flex flex-col items-center py-4">
        <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center mb-3">
          <span className="text-2xl font-bold text-white">{initial}</span>
        </div>
        {profile?.full_name && (
          <p className="text-base font-bold text-gray-900">{profile.full_name}</p>
        )}
        <p className="text-sm text-gray-500">{user.email}</p>
        {profile?.phone && (
          <p className="text-sm text-gray-400 mt-0.5">{profile.phone}</p>
        )}
      </div>

      {/* Loyalty card */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-amber-800">Points fidélité</h2>
          <span className="text-lg font-bold text-blue-700">{profile?.loyalty_points ?? 0} pts</span>
        </div>
        <p className="text-xs text-amber-600 mb-3">
          1 point par km effectué · Points crédités après chaque course
        </p>

        {loyaltyTxs.length > 0 && (
          <div className="border-t border-amber-200 pt-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800 mb-1">Derniers mouvements</p>
            {loyaltyTxs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between">
                <p className="text-xs text-gray-600 truncate flex-1 mr-2">
                  {tx.bookings?.pickup_address?.split(',')[0]} → {tx.bookings?.dropoff_address?.split(',')[0]}
                </p>
                <span className={`text-xs font-semibold ${tx.type === 'earned' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'earned' ? '+' : '-'}{tx.points} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <Link
          href="/history"
          className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="flex-1 text-sm font-medium text-gray-900">Mes réservations</span>
          <span className="text-gray-300 text-lg">›</span>
        </Link>
        <div className="h-px bg-gray-100 ml-12" />
        <Link
          href="/account"
          className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="flex-1 text-sm font-medium text-gray-900">Gérer mon compte</span>
          <span className="text-gray-300 text-lg">›</span>
        </Link>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full bg-red-50 border border-red-200 text-red-600 font-semibold py-3 rounded-xl text-sm hover:bg-red-100 transition-colors"
      >
        Se déconnecter
      </button>

      <p className="text-center text-xs text-gray-400 pb-2">O Taxi v1.0.0</p>
    </div>
  )
}
