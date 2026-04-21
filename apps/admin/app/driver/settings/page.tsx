'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationPermissionButton from '@/components/NotificationPermissionButton'

type NotifPrefs = {
  push_new_broadcast: boolean
  push_assigned: boolean
  push_cancelled: boolean
  push_reminder_30min: boolean
  push_account_status: boolean
  email_welcome: boolean
  email_account_approved: boolean
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  push_new_broadcast: true,
  push_assigned: true,
  push_cancelled: true,
  push_reminder_30min: true,
  push_account_status: true,
  email_welcome: true,
  email_account_approved: true,
}

export default function DriverSettingsPage() {
  const supabase = createClient()

  const [driverId, setDriverId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS)
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Contact fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUserId(user.id)
    setEmail(user.email ?? '')

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, first_name, last_name, phone')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single()

    if (driver) {
      setDriverId(driver.id)
      setFirstName(driver.first_name)
      setLastName(driver.last_name)
      setPhone(driver.phone ?? '')
    }

    const { data: prefs } = await supabase
      .from('driver_notification_preferences')
      .select('*')
      .eq('driver_id', user.id)
      .maybeSingle()

    if (prefs) setNotifPrefs(prefs)
    setLoading(false)
  }

  async function handleSaveNotifPrefs() {
    if (!userId) return
    setSavingNotifs(true)
    await supabase
      .from('driver_notification_preferences')
      .upsert({ ...notifPrefs, driver_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'driver_id' })
    setSavingNotifs(false)
    showNotif('Préférences de notifications enregistrées ✓', 'success')
  }

  function toggleNotif(key: keyof NotifPrefs) {
    setNotifPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  function showNotif(message: string, type: 'success' | 'error') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3500)
  }

  async function handleSaveContact() {
    if (!firstName.trim() || !lastName.trim()) {
      showNotif('Le prénom et le nom sont obligatoires', 'error')
      return
    }
    if (!driverId) return
    setSaving(true)
    const { error } = await supabase
      .from('drivers')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      })
      .eq('id', driverId)

    if (error) showNotif('Erreur lors de la sauvegarde', 'error')
    else showNotif('Informations mises à jour ✓', 'success')
    setSaving(false)
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotif('Tous les champs mot de passe sont requis', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showNotif('Les nouveaux mots de passe ne correspondent pas', 'error')
      return
    }
    if (newPassword.length < 6) {
      showNotif('Le mot de passe doit faire au moins 6 caractères', 'error')
      return
    }

    setSavingPassword(true)

    // Vérifier le mot de passe actuel
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInError) {
      showNotif('Mot de passe actuel incorrect', 'error')
      setSavingPassword(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) showNotif('Erreur lors du changement de mot de passe', 'error')
    else {
      showNotif('Mot de passe changé avec succès ✓', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-5 space-y-5">
      {notification && (
        <div className={`fixed top-20 left-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-center ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>

      {/* Informations de contact */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Informations de contact</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Prénom *</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jean"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom *</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dupont"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Téléphone</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="06 12 34 56 78"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              value={email}
              disabled
              className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">L'adresse email ne peut pas être modifiée ici.</p>
          </div>

          <button
            onClick={handleSaveContact}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>

      {/* Changer le mot de passe */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Changer le mot de passe</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {savingPassword ? 'Vérification…' : 'Changer le mot de passe'}
          </button>
        </div>
      </div>

      {/* Notifications push */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">🔔 Notifications push</h2>
        <NotificationPermissionButton />
        <div className="space-y-1 mt-2">
          {([
            { key: 'push_new_broadcast',  label: 'Nouvelle course disponible' },
            { key: 'push_assigned',       label: 'Course assignée par l\'admin' },
            { key: 'push_cancelled',      label: 'Course annulée' },
            { key: 'push_reminder_30min', label: 'Rappel 30 min avant la course' },
            { key: 'push_account_status', label: 'Changement de statut du compte' },
          ] as { key: keyof NotifPrefs; label: string }[]).map(item => (
            <div key={item.key} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{item.label}</span>
              <button
                onClick={() => toggleNotif(item.key)}
                className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${notifPrefs[item.key] ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifPrefs[item.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications email */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">📧 Notifications e-mail</h2>
        <div className="space-y-1">
          {([
            { key: 'email_welcome',          label: 'E-mail de bienvenue à l\'inscription' },
            { key: 'email_account_approved', label: 'Confirmation compte approuvé' },
          ] as { key: keyof NotifPrefs; label: string }[]).map(item => (
            <div key={item.key} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{item.label}</span>
              <button
                onClick={() => toggleNotif(item.key)}
                className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${notifPrefs[item.key] ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifPrefs[item.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleSaveNotifPrefs}
          disabled={savingNotifs}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
        >
          {savingNotifs ? 'Enregistrement…' : 'Enregistrer les préférences'}
        </button>
      </div>
    </div>
  )
}
