'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0)
  const [loyaltyTxs, setLoyaltyTxs] = useState<LoyaltyTx[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data } = await supabase.from('profiles').select('full_name, phone, loyalty_points').eq('id', user.id).single()
      if (data) {
        setFullName(data.full_name ?? '')
        setPhone(data.phone ?? '')
        setLoyaltyPoints(data.loyalty_points ?? 0)
      }

      const { data: txs } = await supabase
        .from('loyalty_transactions')
        .select('id, type, points, bookings(pickup_address, dropoff_address)')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (txs) setLoyaltyTxs(txs as unknown as LoyaltyTx[])

      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName.trim(),
      phone: phone.trim(),
    })

    setSaving(false)
    if (error) { setError('Une erreur est survenue.'); return }
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/history" className="text-blue-700 text-sm font-medium hover:text-blue-800">← Retour</Link>
        <h1 className="text-base font-semibold text-gray-900">Mon profil</h1>
        <div />
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Avatar */}
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-white">
              {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() ?? '?'}
            </span>
          </div>
          {fullName && <p className="text-base font-semibold text-gray-900">{fullName}</p>}
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>

        {/* Points fidélité */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-amber-800">Points fidélité</h2>
            <span className="text-lg font-bold text-blue-700">{loyaltyPoints} pts</span>
          </div>
          <p className="text-xs text-amber-600 mb-3">1 point par km effectué · Points crédités après chaque course</p>
          {loyaltyTxs.length > 0 && (
            <div className="space-y-2 border-t border-amber-200 pt-3">
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

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Modifier mon profil</h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom et prénom</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-sm text-green-700">Profil mis à jour.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full bg-white border border-gray-200 text-gray-700 font-medium py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors shadow-sm"
        >
          Se déconnecter
        </button>

        <Link
          href="/history"
          className="block text-center text-sm text-blue-700 font-medium py-2 hover:underline"
        >
          Mes réservations
        </Link>
      </div>
    </div>
  )
}
