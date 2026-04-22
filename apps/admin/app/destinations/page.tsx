'use client'

import { useState, useEffect, useRef } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/client'
import { Train, Plane, Check } from '@/components/Icons'

interface Destination {
  id: string
  name: string
  type: 'station' | 'airport'
  lat: number | null
  lng: number | null
  active: boolean
}

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return
    if ((window as any).google?.maps?.places) { resolve(); return }
    const existing = document.getElementById('gm-script')
    if (existing) { existing.addEventListener('load', () => resolve()); return }
    const script = document.createElement('script')
    script.id = 'gm-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

// Composant champ adresse avec Google Places Autocomplete
// Input NON-CONTRÔLÉ : "value" React interfère avec le dropdown natif Google
function PlacesInput({
  initialValue,
  onInput,
  onPlaceSelected,
  placeholder,
}: {
  initialValue?: string
  onInput?: () => void          // appelé quand l'user tape (pour réinitialiser coordsConfirmed)
  onPlaceSelected: (name: string, lat: number, lng: number) => void
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const onPlaceSelectedRef = useRef(onPlaceSelected)
  onPlaceSelectedRef.current = onPlaceSelected   // toujours à jour, pas de stale closure
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadGoogleMaps(MAPS_API_KEY).then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return
    const google = (window as any).google
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ['name', 'geometry', 'formatted_address'],
    })
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace()
      if (!place.geometry?.location) return
      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()
      const name = place.name ?? place.formatted_address ?? ''
      onPlaceSelectedRef.current(name, lat, lng)
    })
  }, [ready])  // Pas de dépendance sur les callbacks — évite les re-attaches

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        defaultValue={initialValue}   // non-contrôlé — Google gère la valeur
        onChange={() => onInput?.()}   // juste pour détecter la frappe
        placeholder={placeholder ?? 'Rechercher une gare, un aéroport…'}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
      />
      {!ready && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">…</span>
      )}
    </div>
  )
}

export default function DestinationsPage() {
  const supabase = createClient()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDest, setEditingDest] = useState<Destination | null>(null)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Formulaire
  const [formAddress, setFormAddress] = useState('')   // texte affiché dans l'input
  const [formName, setFormName] = useState('')          // nom réel à sauvegarder
  const [formType, setFormType] = useState<'station' | 'airport'>('station')
  const [formLat, setFormLat] = useState<number | null>(null)
  const [formLng, setFormLng] = useState<number | null>(null)
  const [coordsConfirmed, setCoordsConfirmed] = useState(false)

  useEffect(() => { fetchDestinations() }, [])

  async function fetchDestinations() {
    setLoading(true)
    const { data } = await supabase
      .from('fare_packages')
      .select('id, name, type, lat, lng, active')
      .order('type').order('name')
    const seen = new Set<string>()
    const unique: Destination[] = []
    for (const d of (data ?? [])) {
      if (!seen.has(d.name)) { seen.add(d.name); unique.push(d as Destination) }
    }
    setDestinations(unique)
    setLoading(false)
  }

  function showNotif(message: string, type: 'success' | 'error') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  function openCreateForm() {
    setEditingDest(null); setFormAddress(''); setFormName(''); setFormType('station')
    setFormLat(null); setFormLng(null); setCoordsConfirmed(false); setShowForm(true)
  }

  function openEditForm(dest: Destination) {
    setEditingDest(dest); setFormAddress(dest.name); setFormName(dest.name)
    setFormType(dest.type); setFormLat(dest.lat); setFormLng(dest.lng)
    setCoordsConfirmed(dest.lat != null); setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditingDest(null) }

  function handlePlaceSelected(name: string, lat: number, lng: number) {
    setFormName(name)
    setFormAddress(name)
    setFormLat(lat)
    setFormLng(lng)
    setCoordsConfirmed(true)
  }

  async function handleSave() {
    if (!formName.trim()) { showNotif('Veuillez sélectionner un lieu dans les suggestions', 'error'); return }
    if (!coordsConfirmed || formLat == null || formLng == null) {
      showNotif('Veuillez sélectionner un lieu dans les suggestions Google pour obtenir les coordonnées', 'error'); return
    }
    setSaving(true)
    try {
      if (editingDest) {
        const { error } = await supabase
          .from('fare_packages')
          .update({ name: formName.trim(), type: formType, lat: formLat, lng: formLng })
          .eq('name', editingDest.name)
        if (error) throw error
        showNotif('Point d\'intérêt mis à jour', 'success')
      } else {
        const { error } = await supabase.from('fare_packages').insert({
          name: formName.trim(), type: formType, lat: formLat, lng: formLng,
          price: 0, active: true, zone_id: null,
        })
        if (error) throw error
        showNotif('Point d\'intérêt créé', 'success')
      }
      await fetchDestinations()
      closeForm()
    } catch (err: any) {
      showNotif(err.message ?? 'Erreur', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(dest: Destination) {
    if (!confirm(`Supprimer "${dest.name}" et tous ses tarifs associés ?`)) return
    const { error } = await supabase.from('fare_packages').delete().eq('name', dest.name)
    if (error) { showNotif('Erreur lors de la suppression', 'error'); return }
    showNotif('Point d\'intérêt supprimé', 'success')
    await fetchDestinations()
  }

  const stations = destinations.filter(d => d.type === 'station')
  const airports = destinations.filter(d => d.type === 'airport')

  return (
    <AdminLayout>
        {notification && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {notification.message}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Points d&apos;intérêt</h1>
            <p className="text-sm text-gray-500 mt-1">Gérez les gares et aéroports disponibles pour les forfaits</p>
          </div>
          {!showForm && (
            <button onClick={openCreateForm} className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              + Ajouter
            </button>
          )}
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-5">
              {editingDest ? `Modifier — ${editingDest.name}` : 'Ajouter un point d\'intérêt'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Rechercher le lieu</label>
                <PlacesInput
                  key={editingDest?.id ?? 'new'}   // force remount à chaque ouverture
                  initialValue={formAddress}
                  onInput={() => setCoordsConfirmed(false)}
                  onPlaceSelected={handlePlaceSelected}
                  placeholder="Tapez le nom de la gare ou de l'aéroport…"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Sélectionnez dans les suggestions pour enregistrer les coordonnées GPS automatiquement.
                </p>
              </div>

              {/* Confirmation coordonnées */}
              {coordsConfirmed && formLat != null && formLng != null && (
                <div className="col-span-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700 font-medium">
                    Coordonnées enregistrées : {formLat.toFixed(5)}, {formLng.toFixed(5)}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={formType} onChange={e => setFormType(e.target.value as 'station' | 'airport')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="station">Gare</option>
                  <option value="airport">Aéroport</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving || !coordsConfirmed}
                className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                {saving ? 'Enregistrement…' : (editingDest ? 'Mettre à jour' : 'Ajouter')}
              </button>
              <button onClick={closeForm} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Listes */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm px-6 py-12 text-center text-gray-400 text-sm">Chargement…</div>
        ) : (
          <div className="space-y-6">
            {/* Gares */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Train className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">Gares</h2>
                <span className="text-sm text-gray-400 ml-auto">{stations.length}</span>
              </div>
              {stations.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">Aucune gare configurée</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3">Nom</th>
                      <th className="px-6 py-3">Coordonnées GPS</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stations.map((dest, i) => (
                      <tr key={dest.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                        <td className="px-6 py-3 font-medium text-gray-900">{dest.name}</td>
                        <td className="px-6 py-3 text-xs font-mono text-gray-500">
                          {dest.lat != null && dest.lng != null
                            ? `${dest.lat.toFixed(5)}, ${dest.lng.toFixed(5)}`
                            : <span className="text-red-400">Non renseigné</span>}
                        </td>
                        <td className="px-6 py-3 flex gap-2">
                          <button onClick={() => openEditForm(dest)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors">Modifier</button>
                          <button onClick={() => handleDelete(dest)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors">Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            {/* Aéroports */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Plane className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">Aéroports</h2>
                <span className="text-sm text-gray-400 ml-auto">{airports.length}</span>
              </div>
              {airports.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">Aucun aéroport configuré</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3">Nom</th>
                      <th className="px-6 py-3">Coordonnées GPS</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {airports.map((dest, i) => (
                      <tr key={dest.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                        <td className="px-6 py-3 font-medium text-gray-900">{dest.name}</td>
                        <td className="px-6 py-3 text-xs font-mono text-gray-500">
                          {dest.lat != null && dest.lng != null
                            ? `${dest.lat.toFixed(5)}, ${dest.lng.toFixed(5)}`
                            : <span className="text-red-400">Non renseigné</span>}
                        </td>
                        <td className="px-6 py-3 flex gap-2">
                          <button onClick={() => openEditForm(dest)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors">Modifier</button>
                          <button onClick={() => handleDelete(dest)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors">Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}
    </AdminLayout>
  )
}
