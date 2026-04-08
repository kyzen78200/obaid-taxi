'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/client'

interface Driver {
  id: string
  user_id: string | null
  first_name: string
  last_name: string
  phone: string | null
  status: 'pending' | 'approved' | 'revoked'
  created_at: string
}

export default function DriversPage() {
  const supabase = createClient()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetchDrivers() }, [])

  async function fetchDrivers() {
    setLoading(true)
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false })
    setDrivers(data ?? [])
    setLoading(false)
  }

  function showNotif(message: string, type: 'success' | 'error') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3500)
  }

  async function handleApprove(driver: Driver) {
    setSaving(driver.id)
    const { error } = await supabase
      .from('drivers')
      .update({ status: 'approved' })
      .eq('id', driver.id)
    if (error) {
      showNotif('Erreur lors de l\'approbation', 'error')
    } else {
      showNotif(`${driver.first_name} ${driver.last_name} approuvé(e)`, 'success')
      fetch('/api/notify/driver-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id, newStatus: 'approved' }),
      }).catch(() => {})
    }
    setSaving(null)
    fetchDrivers()
  }

  async function handleRevoke(driver: Driver) {
    if (!confirm(`Révoquer l'accès de ${driver.first_name} ${driver.last_name} ?`)) return
    setSaving(driver.id)
    const { error } = await supabase
      .from('drivers')
      .update({ status: 'revoked' })
      .eq('id', driver.id)
    if (error) {
      showNotif('Erreur lors de la révocation', 'error')
    } else {
      showNotif(`Accès de ${driver.first_name} ${driver.last_name} révoqué`, 'success')
      fetch('/api/notify/driver-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id, newStatus: 'revoked' }),
      }).catch(() => {})
    }
    setSaving(null)
    fetchDrivers()
  }

  async function handleDelete(driver: Driver) {
    if (!confirm(`Supprimer définitivement ${driver.first_name} ${driver.last_name} ?`)) return
    setSaving(driver.id)
    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', driver.id)
    if (error) showNotif('Erreur lors de la suppression', 'error')
    else showNotif('Chauffeur supprimé', 'success')
    setSaving(null)
    fetchDrivers()
  }

  async function handleCreateDriver() {
    if (!formEmail.trim() || !formPassword.trim() || !formFirstName.trim() || !formLastName.trim()) {
      showNotif('Tous les champs obligatoires doivent être remplis', 'error')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/create-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail.trim(),
          password: formPassword.trim(),
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          phone: formPhone.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur lors de la création')

      showNotif('Chauffeur créé et approuvé', 'success')
      setShowForm(false)
      setFormEmail(''); setFormPassword(''); setFormFirstName(''); setFormLastName(''); setFormPhone('')
      fetchDrivers()
    } catch (err: any) {
      showNotif(err.message ?? 'Erreur lors de la création', 'error')
    } finally {
      setCreating(false)
    }
  }

  const pending  = drivers.filter(d => d.status === 'pending')
  const approved = drivers.filter(d => d.status === 'approved')
  const revoked  = drivers.filter(d => d.status === 'revoked')

  const statusBadge = (s: Driver['status']) => {
    const map = {
      pending:  'bg-yellow-100 text-yellow-800 border border-yellow-200',
      approved: 'bg-green-100 text-green-800 border border-green-200',
      revoked:  'bg-red-100 text-red-800 border border-red-200',
    }
    const labels = { pending: 'En attente', approved: 'Approuvé', revoked: 'Révoqué' }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[s]}`}>
        {labels[s]}
      </span>
    )
  }

  return (
    <AdminLayout>
        {notification && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {notification.message}
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chauffeurs</h1>
            <p className="text-sm text-gray-500 mt-1">Gérez les comptes chauffeurs et leurs accès</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/drivers/export"
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
            >
              ↓ Exporter CSV
            </a>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                + Nouveau chauffeur
              </button>
            )}
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-5">Créer un compte chauffeur</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
                <input value={formFirstName} onChange={e => setFormFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jean" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                <input value={formLastName} onChange={e => setFormLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dupont" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="chauffeur@exemple.fr" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input value={formPhone} onChange={e => setFormPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="06 12 34 56 78" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe provisoire *</label>
                <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mot de passe à communiquer au chauffeur" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreateDriver} disabled={creating}
                className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                {creating ? 'Création…' : 'Créer le chauffeur'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                Annuler
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm px-6 py-12 text-center text-gray-400 text-sm">Chargement…</div>
        ) : (
          <div className="space-y-6">
            {/* Pending approval */}
            {pending.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-yellow-200">
                <div className="px-6 py-4 border-b border-yellow-100 bg-yellow-50 flex items-center gap-2">
                  <span className="text-lg">⏳</span>
                  <h2 className="font-semibold text-yellow-900">En attente d'approbation</h2>
                  <span className="text-sm text-yellow-600 ml-auto">{pending.length}</span>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3">Nom</th>
                      <th className="px-6 py-3">Téléphone</th>
                      <th className="px-6 py-3">Inscrit le</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((d, i) => (
                      <tr key={d.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-3 font-medium text-gray-900">{d.first_name} {d.last_name}</td>
                        <td className="px-6 py-3 text-gray-600">{d.phone ?? '—'}</td>
                        <td className="px-6 py-3 text-gray-500 text-xs">
                          {new Date(d.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-3 flex gap-2">
                          <button onClick={() => handleApprove(d)} disabled={saving === d.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 disabled:opacity-50 transition-colors">
                            Approuver
                          </button>
                          <button onClick={() => handleDelete(d)} disabled={saving === d.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 transition-colors">
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Approved drivers */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="text-lg">✅</span>
                <h2 className="font-semibold text-gray-900">Chauffeurs actifs</h2>
                <span className="text-sm text-gray-400 ml-auto">{approved.length}</span>
              </div>
              {approved.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">Aucun chauffeur actif</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3">Nom</th>
                      <th className="px-6 py-3">Téléphone</th>
                      <th className="px-6 py-3">Statut</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approved.map((d, i) => (
                      <tr key={d.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                        <td className="px-6 py-3 font-medium text-gray-900">{d.first_name} {d.last_name}</td>
                        <td className="px-6 py-3 text-gray-600">{d.phone ?? '—'}</td>
                        <td className="px-6 py-3">{statusBadge(d.status)}</td>
                        <td className="px-6 py-3 flex gap-2">
                          <button onClick={() => handleRevoke(d)} disabled={saving === d.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 disabled:opacity-50 transition-colors">
                            Révoquer
                          </button>
                          <button onClick={() => handleDelete(d)} disabled={saving === d.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 transition-colors">
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            {/* Revoked */}
            {revoked.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-lg">🚫</span>
                  <h2 className="font-semibold text-gray-900">Accès révoqués</h2>
                  <span className="text-sm text-gray-400 ml-auto">{revoked.length}</span>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3">Nom</th>
                      <th className="px-6 py-3">Téléphone</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revoked.map((d, i) => (
                      <tr key={d.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-3 font-medium text-gray-500">{d.first_name} {d.last_name}</td>
                        <td className="px-6 py-3 text-gray-400">{d.phone ?? '—'}</td>
                        <td className="px-6 py-3 flex gap-2">
                          <button onClick={() => handleApprove(d)} disabled={saving === d.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 disabled:opacity-50 transition-colors">
                            Réactiver
                          </button>
                          <button onClick={() => handleDelete(d)} disabled={saving === d.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 transition-colors">
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        )}
    </AdminLayout>
  )
}
