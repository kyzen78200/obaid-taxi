'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/client'
import { Train, Plane } from 'lucide-react'

interface Zone {
  id: string
  name: string
  center_lat: number
  center_lng: number
  radius_km: number
  active: boolean
  created_at: string
}

interface Destination {
  id: string
  name: string
  type: 'station' | 'airport'
}

interface FarePackage {
  id: string
  zone_id: string
  name: string
  type: 'station' | 'airport'
  price: number
  active: boolean
}

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return
    if ((window as any).google?.maps) { resolve(); return }
    const existing = document.getElementById('gm-script')
    if (existing) { existing.addEventListener('load', () => resolve()); return }
    const script = document.createElement('script')
    script.id = 'gm-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    script.async = true
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

function ZoneMap({
  centerLat, centerLng, radiusKm, onCenterChange,
}: {
  centerLat: number; centerLng: number; radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => { loadGoogleMaps(MAPS_API_KEY).then(() => setReady(true)) }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    const google = (window as any).google
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        zoom: 11, center: { lat: centerLat, lng: centerLng },
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'off' }] }],
      })
      markerRef.current = new google.maps.Marker({ position: { lat: centerLat, lng: centerLng }, map: mapInstanceRef.current, draggable: true })
      circleRef.current = new google.maps.Circle({
        map: mapInstanceRef.current, center: { lat: centerLat, lng: centerLng }, radius: radiusKm * 1000,
        fillColor: '#1D4ED8', fillOpacity: 0.15, strokeColor: '#1D4ED8', strokeOpacity: 0.6, strokeWeight: 2,
      })
      markerRef.current.addListener('dragend', () => {
        const pos = markerRef.current.getPosition()
        circleRef.current.setCenter({ lat: pos.lat(), lng: pos.lng() })
        onCenterChange(pos.lat(), pos.lng())
      })
      mapInstanceRef.current.addListener('click', (e: any) => {
        const lat = e.latLng.lat(); const lng = e.latLng.lng()
        markerRef.current.setPosition({ lat, lng }); circleRef.current.setCenter({ lat, lng }); onCenterChange(lat, lng)
      })
    } else {
      markerRef.current.setPosition({ lat: centerLat, lng: centerLng })
      circleRef.current.setCenter({ lat: centerLat, lng: centerLng })
    }
  }, [ready, centerLat, centerLng])

  useEffect(() => { if (circleRef.current) circleRef.current.setRadius(radiusKm * 1000) }, [radiusKm])

  if (!MAPS_API_KEY) return (
    <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
      Clé API Google Maps non configurée
    </div>
  )
  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-64 rounded-xl overflow-hidden border border-gray-200" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl"><span className="text-sm text-gray-400">Chargement…</span></div>}
      <p className="text-xs text-gray-400 mt-1">Cliquez sur la carte ou glissez le marqueur pour définir le centre.</p>
    </div>
  )
}

export default function ZonesPage() {
  const supabase = createClient()
  const [zones, setZones] = useState<Zone[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Formulaire zone
  const [formName, setFormName] = useState('')
  const [formLat, setFormLat] = useState(48.99)
  const [formLng, setFormLng] = useState(1.717)
  const [formRadius, setFormRadius] = useState(8)

  // Tarifs par destination pour la zone en cours d'édition
  const [tarifs, setTarifs] = useState<Record<string, string>>({}) // destinationId → prix (string pour l'input)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: zonesData }, { data: destData }] = await Promise.all([
      supabase.from('zones').select('*').order('created_at', { ascending: false }),
      supabase.from('fare_packages').select('id, name, type').order('name'),
    ])
    // Dédupliquer les destinations par nom
    const seen = new Set<string>()
    const unique: Destination[] = []
    for (const d of (destData ?? [])) {
      if (!seen.has(d.name)) { seen.add(d.name); unique.push(d) }
    }
    setZones(zonesData ?? [])
    setDestinations(unique)
    setLoading(false)
  }

  async function loadTarifsForZone(zoneId: string) {
    const { data } = await supabase
      .from('fare_packages')
      .select('name, price')
      .eq('zone_id', zoneId)
    const map: Record<string, string> = {}
    for (const pkg of (data ?? [])) { map[pkg.name] = String(pkg.price) }
    setTarifs(map)
  }

  function showNotif(message: string, type: 'success' | 'error') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  function openCreateForm() {
    setEditingZone(null); setFormName(''); setFormLat(48.99); setFormLng(1.717); setFormRadius(8)
    setTarifs({}); setShowForm(true)
  }

  async function openEditForm(zone: Zone) {
    setEditingZone(zone); setFormName(zone.name); setFormLat(zone.center_lat)
    setFormLng(zone.center_lng); setFormRadius(zone.radius_km)
    await loadTarifsForZone(zone.id); setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditingZone(null) }

  async function handleSave() {
    if (!formName.trim()) { showNotif('Le nom est requis', 'error'); return }
    if (formRadius <= 0) { showNotif('Le rayon doit être > 0', 'error'); return }
    setSaving(true)
    try {
      let zoneId = editingZone?.id ?? ''

      if (editingZone) {
        const { error } = await supabase.from('zones').update({
          name: formName.trim(), center_lat: formLat, center_lng: formLng, radius_km: formRadius,
        }).eq('id', editingZone.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('zones').insert({
          name: formName.trim(), center_lat: formLat, center_lng: formLng, radius_km: formRadius, active: true,
        }).select('id').single()
        if (error) throw error
        zoneId = data.id
      }

      // Sauvegarder les tarifs : upsert fare_packages pour chaque destination
      for (const dest of destinations) {
        const priceStr = tarifs[dest.name]
        if (!priceStr) continue
        const price = parseFloat(priceStr)
        if (isNaN(price) || price < 0) continue

        // Chercher si un package existe déjà pour cette zone × destination
        const { data: existing } = await supabase
          .from('fare_packages')
          .select('id')
          .eq('zone_id', zoneId)
          .eq('name', dest.name)
          .single()

        if (existing) {
          await supabase.from('fare_packages').update({ price, active: true }).eq('id', existing.id)
        } else {
          // Récupérer les coordonnées de la destination depuis une entrée existante
          const { data: ref } = await supabase.from('fare_packages').select('lat, lng').eq('name', dest.name).single()
          await supabase.from('fare_packages').insert({
            zone_id: zoneId, name: dest.name, type: dest.type, price,
            active: true, lat: ref?.lat ?? null, lng: ref?.lng ?? null,
          })
        }
      }

      showNotif(editingZone ? 'Zone mise à jour' : 'Zone créée', 'success')
      await fetchAll()
      closeForm()
    } catch (err: any) {
      showNotif(err.message ?? 'Erreur', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(zone: Zone) {
    await supabase.from('zones').update({ active: !zone.active }).eq('id', zone.id)
    setZones(prev => prev.map(z => z.id === zone.id ? { ...z, active: !z.active } : z))
    showNotif(`Zone ${!zone.active ? 'activée' : 'désactivée'}`, 'success')
  }

  const onCenterChange = useCallback((lat: number, lng: number) => {
    setFormLat(parseFloat(lat.toFixed(6))); setFormLng(parseFloat(lng.toFixed(6)))
  }, [])

  const stations = destinations.filter(d => d.type === 'station')
  const airports = destinations.filter(d => d.type === 'airport')

  return (
    <AdminLayout>
        {notification && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {notification.message}
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zones tarifaires</h1>
            <p className="text-sm text-gray-500 mt-1">Définissez les zones géographiques et leurs tarifs forfaitaires</p>
          </div>
          {!showForm && (
            <button onClick={openCreateForm} className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start sm:self-auto">
              + Nouvelle zone
            </button>
          )}
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-5 text-base">
              {editingZone ? `Modifier — ${editingZone.name}` : 'Créer une zone'}
            </h2>

            {/* Infos zone */}
            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la zone</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="Ex : Mantes-la-Jolie, Poissy…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rayon (km)</label>
                  <input type="number" min="0.5" max="100" step="0.5" value={formRadius}
                    onChange={e => setFormRadius(parseFloat(e.target.value) || 1)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Centre (lat / lng)</label>
                  <div className="flex gap-2">
                    <input type="number" step="0.000001" value={formLat} onChange={e => setFormLat(parseFloat(e.target.value) || 0)}
                      placeholder="Latitude" className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="number" step="0.000001" value={formLng} onChange={e => setFormLng(parseFloat(e.target.value) || 0)}
                      placeholder="Longitude" className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            </div>

            <ZoneMap centerLat={formLat} centerLng={formLng} radiusKm={formRadius} onCenterChange={onCenterChange} />

            {/* Tarifs par destination */}
            {destinations.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Tarifs forfaitaires pour cette zone</h3>
                <p className="text-xs text-gray-400 mb-4">Laissez vide pour ne pas proposer de forfait vers cette destination depuis cette zone.</p>

                {stations.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Train className="w-3.5 h-3.5" /> Gares</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {stations.map(dest => (
                        <div key={dest.name} className="flex items-center gap-2">
                          <label className="text-sm text-gray-700 flex-1 truncate">{dest.name}</label>
                          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden w-28">
                            <input type="number" min="0" step="0.5"
                              value={tarifs[dest.name] ?? ''}
                              onChange={e => setTarifs(prev => ({ ...prev, [dest.name]: e.target.value }))}
                              placeholder="—"
                              className="w-full px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <span className="px-2 text-gray-400 text-sm bg-gray-50 border-l border-gray-300">€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {airports.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Plane className="w-3.5 h-3.5" /> Aéroports</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {airports.map(dest => (
                        <div key={dest.name} className="flex items-center gap-2">
                          <label className="text-sm text-gray-700 flex-1 truncate">{dest.name}</label>
                          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden w-28">
                            <input type="number" min="0" step="0.5"
                              value={tarifs[dest.name] ?? ''}
                              onChange={e => setTarifs(prev => ({ ...prev, [dest.name]: e.target.value }))}
                              placeholder="—"
                              className="w-full px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <span className="px-2 text-gray-400 text-sm bg-gray-50 border-l border-gray-300">€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                {saving ? 'Enregistrement…' : (editingZone ? 'Mettre à jour' : 'Créer la zone')}
              </button>
              <button onClick={closeForm} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste des zones */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Zones définies</h2>
            <span className="text-sm text-gray-400">{zones.length} zone{zones.length !== 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">Chargement…</div>
          ) : zones.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">Aucune zone définie.</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3">Nom</th>
                  <th className="px-6 py-3">Centre</th>
                  <th className="px-6 py-3">Rayon</th>
                  <th className="px-6 py-3">Statut</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone, i) => (
                  <tr key={zone.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                    <td className="px-6 py-4 font-medium text-gray-900">{zone.name}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">{zone.center_lat.toFixed(4)}, {zone.center_lng.toFixed(4)}</td>
                    <td className="px-6 py-4 text-gray-700">{zone.radius_km} km</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${zone.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {zone.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <button onClick={() => openEditForm(zone)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors">
                        Modifier
                      </button>
                      <button onClick={() => toggleActive(zone)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${zone.active ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}>
                        {zone.active ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
    </AdminLayout>
  )
}
