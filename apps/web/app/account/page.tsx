'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type NotifPrefs = {
  email_booking_confirmed: boolean
  email_reminder_day_before: boolean
  email_booking_recap: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  email_booking_confirmed: true,
  email_reminder_day_before: true,
  email_booking_recap: true,
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-blue-700' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [notifMsg, setNotifMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single()
      if (profile) {
        setFullName(profile.full_name ?? '')
        setPhone(profile.phone ?? '')
      }

      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('email_booking_confirmed, email_reminder_day_before, email_booking_recap')
        .eq('user_id', user.id)
        .maybeSingle()
      if (prefs) setNotifPrefs(prefs)
    }
    load()
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq('id', user.id)
    setSavingProfile(false)
    setProfileMsg(error
      ? { type: 'error', text: 'Impossible de mettre à jour le profil.' }
      : { type: 'success', text: 'Informations mises à jour.' }
    )
    setTimeout(() => setProfileMsg(null), 3000)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)
    if (!currentPassword) { setPasswordMsg({ type: 'error', text: 'Saisissez votre mot de passe actuel.' }); return }
    if (newPassword.length < 8) { setPasswordMsg({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' }); return }
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' }); return }

    setSavingPassword(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) {
      setSavingPassword(false)
      setPasswordMsg({ type: 'error', text: 'Mot de passe actuel incorrect.' })
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      setPasswordMsg({ type: 'error', text: 'Impossible de modifier le mot de passe.' })
    } else {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg({ type: 'success', text: 'Mot de passe modifié.' })
      setTimeout(() => setPasswordMsg(null), 3000)
    }
  }

  async function handleSaveNotifs(e: React.FormEvent) {
    e.preventDefault()
    setSavingNotifs(true)
    setNotifMsg(null)
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ ...notifPrefs, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setSavingNotifs(false)
    setNotifMsg(error
      ? { type: 'error', text: 'Impossible d\'enregistrer les préférences.' }
      : { type: 'success', text: 'Préférences enregistrées.' }
    )
    setTimeout(() => setNotifMsg(null), 3000)
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.otaxi.fr'
      const res = await fetch(`${adminUrl}/api/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? 'Impossible de supprimer le compte.')
        return
      }
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      alert('Impossible de supprimer le compte. Vérifiez votre connexion.')
    } finally {
      setDeletingAccount(false)
      setShowDeleteConfirm(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/profile" className="text-blue-700 text-sm font-medium hover:text-blue-800">← Retour</Link>
        <h1 className="text-base font-semibold text-gray-900">Mon compte</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Personal info */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Informations personnelles</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
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
            {profileMsg && (
              <div className={`rounded-xl px-4 py-3 ${profileMsg.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm ${profileMsg.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{profileMsg.text}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {savingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </form>
        </div>

        {/* Email notifications */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Notifications e-mail</h2>
          <form onSubmit={handleSaveNotifs} className="space-y-1">
            {([
              { key: 'email_booking_confirmed' as const,   label: 'Confirmation de réservation' },
              { key: 'email_reminder_day_before' as const, label: 'Rappel la veille' },
              { key: 'email_booking_recap' as const,       label: 'Récapitulatif après la course' },
            ]).map(item => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{item.label}</span>
                <Toggle
                  checked={notifPrefs[item.key]}
                  onChange={v => setNotifPrefs(p => ({ ...p, [item.key]: v }))}
                />
              </div>
            ))}
            {notifMsg && (
              <div className={`rounded-xl px-4 py-3 mt-2 ${notifMsg.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm ${notifMsg.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{notifMsg.text}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={savingNotifs}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-4"
            >
              {savingNotifs ? 'Enregistrement...' : 'Enregistrer les préférences'}
            </button>
          </form>
        </div>

        {/* Security / password */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Sécurité</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe actuel</label>
              <div className="relative">
                <input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Votre mot de passe actuel" className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowCurrentPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showCurrentPassword ? (<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>)}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nouveau mot de passe</label>
              <div className="relative">
                <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Au moins 8 caractères" className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowNewPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showNewPassword ? (<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>)}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirmer le mot de passe</label>
              <div className="relative">
                <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Répétez le mot de passe" className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showConfirmPassword ? (<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>)}
                </button>
              </div>
            </div>
            {passwordMsg && (
              <div className={`rounded-xl px-4 py-3 ${passwordMsg.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{passwordMsg.text}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={savingPassword}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {savingPassword ? 'Modification...' : 'Changer le mot de passe'}
            </button>
          </form>
        </div>

        {/* Delete account */}
        <div className="space-y-3 pt-1 pb-4">
          <p className="text-xs text-gray-400 text-center">
            La suppression de votre compte est définitive et irréversible.
            Toutes vos données personnelles seront effacées.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full bg-red-50 border border-red-200 text-red-600 font-semibold py-3 rounded-xl text-sm hover:bg-red-100 transition-colors"
            >
              Supprimer mon compte
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700 text-center">
                Êtes-vous sûr ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {deletingAccount ? 'Suppression...' : 'Oui, supprimer'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
