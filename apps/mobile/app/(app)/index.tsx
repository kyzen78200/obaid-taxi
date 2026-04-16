import { useState, useRef, useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions,
  Animated, PanResponder,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Location from 'expo-location'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useBookingStore } from '../../store/booking'
import { useAuthStore } from '../../store/auth'
import { getRouteInfo, GOOGLE_MAPS_API_KEY } from '../../lib/google-maps'
import { supabase } from '../../lib/supabase'
import { haversineDistance } from '../../lib/haversine'
import { calculateFare } from '@obaid-taxi/shared'
import type { TripType, Coordinates } from '@obaid-taxi/shared'

type Destination = { name: string; type: 'station' | 'airport'; lat: number; lng: number }
type Zone = { id: string; name: string; center_lat: number; center_lng: number; radius_km: number }

// Centre par défaut : Mantes-la-Jolie
const DEFAULT_REGION = { latitude: 48.99, longitude: 1.717, latitudeDelta: 0.18, longitudeDelta: 0.18 }
const SCREEN_HEIGHT = Dimensions.get('window').height

// Hauteur du sheet en mode réduit : handle (24px) + une ligne de résumé (44px)
const SNAP_COMPACT = 68
// Gap minimal entre le haut du sheet étendu et le bas de la carte d'adresses
const SHEET_GAP = 16

// Style carte épuré façon Uber (gris, sans POIs colorés)
const MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#f2f2f2' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#717171' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#f2f2f2' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
  { featureType: 'road',       elementType: 'geometry',           stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',       elementType: 'geometry.stroke',    stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road.highway', elementType: 'geometry',         stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke',  stylers: [{ color: '#d0d0d0' }] },
  { featureType: 'water',      elementType: 'geometry',           stylers: [{ color: '#c8d8e8' }] },
  { featureType: 'landscape',  elementType: 'geometry',           stylers: [{ color: '#ebebeb' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
]

const TAB_BAR_HEIGHT = 56

export default function SearchScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    prefill_pickup?: string
    prefill_pickup_lat?: string
    prefill_pickup_lng?: string
    prefill_dropoff?: string
    prefill_dropoff_lat?: string
    prefill_dropoff_lng?: string
    prefill_trip_type?: string
  }>()
  const { setFormData, setEstimate, setRoutePolyline } = useBookingStore()
  const mapRef = useRef<MapView>(null)
  const { profile } = useAuthStore()
  const insets = useSafeAreaInsets()

  // ── Champs du formulaire ──────────────────────────────────────────────────
  const [pickup, setPickup] = useState<{ address: string; coords: Coordinates } | null>(null)
  const [dropoff, setDropoff] = useState<{ address: string; coords: Coordinates } | null>(null)
  const [scheduledAt, setScheduledAt] = useState<Date>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [tripType, setTripType] = useState<TripType>('one_way')
  const [isConventional, setIsConventional] = useState(false)
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [isForfaitZone, setIsForfaitZone] = useState(false)
  const [forfaitDirection, setForfaitDirection] = useState<'to' | 'from'>('to')
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)

  const pickupRef  = useRef<any>(null)
  const dropoffRef = useRef<any>(null)

  // ── Pré-remplissage "Reprendre ce trajet" ────────────────────────────────
  useEffect(() => {
    if (params.prefill_pickup && params.prefill_pickup_lat && params.prefill_pickup_lng) {
      const p = {
        address: params.prefill_pickup,
        coords: { lat: parseFloat(params.prefill_pickup_lat), lng: parseFloat(params.prefill_pickup_lng) },
      }
      setPickup(p)
      // Délai pour laisser le composant GooglePlacesAutocomplete se monter
      setTimeout(() => pickupRef.current?.setAddressText(params.prefill_pickup!), 200)
    }
    if (params.prefill_dropoff && params.prefill_dropoff_lat && params.prefill_dropoff_lng) {
      const d = {
        address: params.prefill_dropoff,
        coords: { lat: parseFloat(params.prefill_dropoff_lat), lng: parseFloat(params.prefill_dropoff_lng) },
      }
      setDropoff(d)
      setTimeout(() => dropoffRef.current?.setAddressText(params.prefill_dropoff!), 200)
    }
    if (params.prefill_trip_type === 'round_trip' || params.prefill_trip_type === 'one_way') {
      setTripType(params.prefill_trip_type)
    }
    // Ouvrir le sheet si pré-rempli
    if (params.prefill_pickup || params.prefill_dropoff) {
      setTimeout(() => snapTo(true), 400)
    }
  }, [])

  // ── Snap bottom sheet ─────────────────────────────────────────────────────
  const sheetHeight   = useRef(new Animated.Value(SNAP_COMPACT)).current
  const lastHeight    = useRef(SNAP_COMPACT)
  const [isExpanded, setIsExpanded] = useState(false)

  // Mesures dynamiques — stockées en ref pour être accessibles dans PanResponder
  const topSectionBottomRef = useRef(0)
  const contentHeightRef    = useRef(0)
  const isExpandedRef       = useRef(false)

  const [topSectionBottom, _setTopSectionBottom] = useState(0)
  const [contentHeight,    _setContentHeight]    = useState(0)

  function setTopSectionBottom(v: number) { topSectionBottomRef.current = v; _setTopSectionBottom(v) }
  function setContentHeight(v: number)    { contentHeightRef.current = v;    _setContentHeight(v) }

  function getExpandedHeight() {
    const maxH   = SCREEN_HEIGHT - topSectionBottomRef.current - SHEET_GAP
    const target = contentHeightRef.current + SNAP_COMPACT
    return Math.min(Math.max(target, SNAP_COMPACT + 80), maxH)
  }

  function snapTo(expanded: boolean) {
    const target = expanded ? getExpandedHeight() : SNAP_COMPACT
    lastHeight.current  = target
    isExpandedRef.current = expanded
    setIsExpanded(expanded)
    Animated.spring(sheetHeight, {
      toValue: target,
      useNativeDriver: false,
      tension: 60,
      friction: 12,
    }).start()
  }

  function refreshExpandedHeight() {
    if (!isExpandedRef.current) return
    const target = getExpandedHeight()
    lastHeight.current = target
    sheetHeight.setValue(target)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderMove: (_, gs) => {
        const maxH = SCREEN_HEIGHT - topSectionBottomRef.current - SHEET_GAP
        const next = Math.max(SNAP_COMPACT, Math.min(maxH, lastHeight.current - gs.dy))
        sheetHeight.setValue(next)
      },
      onPanResponderRelease: (_, gs) => {
        const projected = lastHeight.current - gs.dy
        const mid = (SNAP_COMPACT + getExpandedHeight()) / 2
        snapTo(projected > mid)
      },
    })
  ).current

  function fitMapToMarkers(p: typeof pickup, d: typeof dropoff) {
    if (!p || !d) return
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: p.coords.lat, longitude: p.coords.lng },
          { latitude: d.coords.lat, longitude: d.coords.lng },
        ],
        { edgePadding: { top: 24, right: 24, bottom: 24, left: 24 }, animated: true }
      )
    }, 300)
  }

  // ── Géolocalisation ───────────────────────────────────────────────────────
  async function handleUseCurrentLocation() {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la localisation dans les paramètres.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const [geo] = await Location.reverseGeocodeAsync(loc.coords)
      const address = [geo.streetNumber, geo.street, geo.city].filter(Boolean).join(', ')

      setPickup({
        address,
        coords: { lat: loc.coords.latitude, lng: loc.coords.longitude },
      })
      pickupRef.current?.setAddressText(address)
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer votre position.')
    } finally {
      setLocating(false)
    }
  }

  // ── Chargement des destinations gares/aéroports ──
  async function loadDestinations() {
    const { data } = await supabase
      .from('fare_packages')
      .select('name, type, lat, lng')
      .eq('active', true)
    if (data) {
      // Dédupliquer par nom (une destination peut avoir plusieurs prix selon la zone)
      const seen = new Set<string>()
      const unique: Destination[] = []
      for (const d of data) {
        if (!seen.has(d.name)) {
          seen.add(d.name)
          unique.push(d as Destination)
        }
      }
      setDestinations(unique)
    }
  }

  async function handleForfaitZoneToggle(value: boolean) {
    setIsForfaitZone(value)
    if (value) {
      await loadDestinations()
    } else {
      setDestinations([])
      setSelectedDestination(null)
    }
  }

  // ── Calcul de l'estimation ────────────────────────────────────────────────
  async function handleCalculate() {
    if (!pickup) {
      Alert.alert('Adresse manquante', 'Indiquez votre adresse.')
      return
    }

    // ── Flux forfait gare/aéroport ──
    if (isForfaitZone) {
      if (!selectedDestination) {
        Alert.alert('Gare / aéroport manquant', 'Sélectionnez une gare ou un aéroport.')
        return
      }

      setLoading(true)
      try {
        // 1. Récupérer toutes les zones actives
        const { data: zones } = await supabase
          .from('zones')
          .select('id, name, center_lat, center_lng, radius_km')
          .eq('active', true)

        // 2. Trouver les zones dont l'adresse du client est dans le rayon
        const matchingZones: (Zone & { distance: number })[] = []
        for (const z of (zones ?? []) as Zone[]) {
          const dist = haversineDistance(
            pickup.coords,
            { lat: z.center_lat, lng: z.center_lng }
          )
          if (dist <= z.radius_km) {
            matchingZones.push({ ...z, distance: dist })
          }
        }

        // 3. Choisir la zone la plus proche si plusieurs matchent
        matchingZones.sort((a, b) => a.distance - b.distance)
        const closestZone = matchingZones[0] ?? null

        const stationCoords = { lat: selectedDestination.lat, lng: selectedDestination.lng }
        const pickupCoords  = forfaitDirection === 'to' ? pickup.coords  : stationCoords
        const dropoffCoords = forfaitDirection === 'to' ? stationCoords  : pickup.coords
        const pickupAddr    = forfaitDirection === 'to' ? pickup.address : selectedDestination.name
        const dropoffAddr   = forfaitDirection === 'to' ? selectedDestination.name : pickup.address

        const doCalculate = async (forfaitId?: string, forfaitPrice?: number) => {
          const route = await getRouteInfo(pickupCoords, dropoffCoords)
          const estimate = calculateFare({
            distanceKm: route.distance_km,
            durationMin: route.duration_min,
            departureTime: scheduledAt,
            tripType: 'one_way',
            ...(forfaitPrice ? { forfaitPrice, forfaitName: selectedDestination!.name } : {}),
          })
          setFormData({
            pickup_address: pickupAddr,
            pickup_coords: pickupCoords,
            dropoff_address: dropoffAddr,
            dropoff_coords: dropoffCoords,
            scheduled_at: scheduledAt,
            trip_type: 'one_way',
            is_conventional: isConventional,
            ...(forfaitId ? { forfait_id: forfaitId } : {}),
          })
          setEstimate(estimate)
          setRoutePolyline(route.encoded_polyline)
          router.push('/(app)/estimate')
        }

        if (!closestZone) {
          // Adresse hors de toute zone
          Alert.alert(
            'Aucun forfait disponible',
            `Votre adresse ne correspond à aucune zone forfait pour ${selectedDestination.name}.\n\nVoulez-vous voir une estimation kilométrique ?`,
            [
              { text: 'Modifier ma recherche', style: 'cancel' },
              { text: 'Voir l\'estimation', onPress: async () => {
                setLoading(true)
                try { await doCalculate() } catch (err: any) {
                  Alert.alert('Erreur', err.message ?? 'Impossible de calculer l\'itinéraire.')
                } finally { setLoading(false) }
              }},
            ]
          )
          return
        }

        // 4. Chercher le forfait pour cette zone × cette destination
        const { data: pkg } = await supabase
          .from('fare_packages')
          .select('id, price')
          .eq('zone_id', closestZone.id)
          .eq('name', selectedDestination.name)
          .eq('active', true)
          .single()

        if (!pkg) {
          // Zone trouvée mais pas de forfait pour cette destination
          Alert.alert(
            'Forfait non disponible',
            `Il n'existe pas de forfait pour ${selectedDestination.name} depuis la zone ${closestZone.name}.\n\nVoulez-vous voir une estimation kilométrique ?`,
            [
              { text: 'Modifier ma recherche', style: 'cancel' },
              { text: 'Voir l\'estimation', onPress: async () => {
                setLoading(true)
                try { await doCalculate() } catch (err: any) {
                  Alert.alert('Erreur', err.message ?? 'Impossible de calculer l\'itinéraire.')
                } finally { setLoading(false) }
              }},
            ]
          )
          return
        }

        // Forfait trouvé → calcul avec le prix du forfait
        await doCalculate(pkg.id, pkg.price)
      } catch (err: any) {
        Alert.alert('Erreur', err.message ?? 'Impossible de calculer l\'itinéraire.')
      } finally {
        setLoading(false)
      }
      return
    }

    // ── Flux standard ──
    if (!dropoff) {
      Alert.alert('Destination manquante', 'Indiquez une destination.')
      return
    }
    if (scheduledAt < new Date()) {
      Alert.alert('Date invalide', 'La date de départ doit être dans le futur.')
      return
    }

    setLoading(true)
    try {
      const route = await getRouteInfo(pickup.coords, dropoff.coords)
      const estimate = calculateFare({
        distanceKm: route.distance_km,
        durationMin: route.duration_min,
        departureTime: scheduledAt,
        tripType,
      })
      setFormData({
        pickup_address: pickup.address,
        pickup_coords: pickup.coords,
        dropoff_address: dropoff.address,
        dropoff_coords: dropoff.coords,
        scheduled_at: scheduledAt,
        trip_type: tripType,
        is_conventional: isConventional,
      })
      setEstimate(estimate)
      setRoutePolyline(route.encoded_polyline)
      router.push('/(app)/estimate')
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de calculer l\'itinéraire.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <View style={styles.container}>
      {/* ── Carte plein écran en fond ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        customMapStyle={MAP_STYLE}
      >
        {pickup && (
          <Marker coordinate={{ latitude: pickup.coords.lat, longitude: pickup.coords.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerPickup}><View style={styles.markerPickupInner} /></View>
          </Marker>
        )}
        {dropoff && (
          <Marker coordinate={{ latitude: dropoff.coords.lat, longitude: dropoff.coords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.markerDropoff}><Text style={styles.markerDropoffText}>B</Text></View>
          </Marker>
        )}
      </MapView>

      {/* ── Overlay UI ── */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* ── Top : salutation + champs d'adresse ── */}
          <View
            style={styles.topSection}
            onLayout={e => setTopSectionBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
          >
            <View style={styles.greetingPill}>
              <Text style={styles.greeting}>
                Bonjour{profile?.full_name ? ` ${profile.full_name.split(' ')[0]}` : ''}
              </Text>
              <Text style={styles.title}>Où allons-nous ?</Text>
            </View>

            {/* Champs d'adresse — EN DEHORS du ScrollView (VirtualizedList) */}
            <View style={[styles.card, styles.locationCard]}>
              <View style={styles.locationRow}>
                <View style={[styles.dot, styles.dotBlue]} />
                <View style={styles.autocompleteWrapper}>
                  <GooglePlacesAutocomplete
                    ref={pickupRef}
                    placeholder={isForfaitZone ? 'Votre adresse' : 'Point de départ'}
                    onPress={(data, details) => {
                      if (details?.geometry?.location) {
                        const newPickup = {
                          address: data.description,
                          coords: { lat: details.geometry.location.lat, lng: details.geometry.location.lng },
                        }
                        setPickup(newPickup)
                        fitMapToMarkers(newPickup, dropoff)
                      }
                    }}
                    query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr', components: 'country:fr' }}
                    fetchDetails
                    styles={placesStyles}
                    enablePoweredByContainer={false}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
                <TouchableOpacity onPress={handleUseCurrentLocation} style={styles.locationBtn}>
                  {locating
                    ? <ActivityIndicator size="small" color="#1D4ED8" />
                    : <Ionicons name="locate" size={18} color="#1D4ED8" />
                  }
                </TouchableOpacity>
              </View>

              {!isForfaitZone && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.locationRow}>
                    <View style={[styles.dot, styles.dotGray]} />
                    <View style={styles.autocompleteWrapper}>
                      <GooglePlacesAutocomplete
                        ref={dropoffRef}
                        placeholder="Destination"
                        onPress={(data, details) => {
                          if (details?.geometry?.location) {
                            const newDropoff = {
                              address: data.description,
                              coords: { lat: details.geometry.location.lat, lng: details.geometry.location.lng },
                            }
                            setDropoff(newDropoff)
                            fitMapToMarkers(pickup, newDropoff)
                          }
                        }}
                        query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr', components: 'country:fr' }}
                        fetchDetails
                        styles={placesStyles}
                        enablePoweredByContainer={false}
                        keyboardShouldPersistTaps="handled"
                      />
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Espace flexible (carte visible) ── */}
          <View style={{ flex: 1 }} pointerEvents="none" />

          {/* ── Bottom sheet snap (2 positions) ── */}
          <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]}>

            {/* Handle — drag pour snap */}
            <View {...panResponder.panHandlers} style={styles.handleZone}>
              <View style={styles.bottomHandle} />
              {/* Une seule ligne résumé, visible uniquement en mode compact */}
              {!isExpanded && (
                <TouchableOpacity style={styles.compactSummary} onPress={() => snapTo(true)} activeOpacity={0.7}>
                  <Text style={styles.compactLine} numberOfLines={1}>
                    {formatDate(scheduledAt)}{'  ·  '}{formatTime(scheduledAt)}
                    {'   '}
                    {!isForfaitZone
                      ? (tripType === 'one_way' ? 'Aller simple' : 'Aller-retour')
                      : (selectedDestination ? selectedDestination.name : 'Gare / Aéroport')
                    }
                  </Text>
                  <Text style={styles.compactChevron}>⌃</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Contenu scrollable — visible en mode étendu */}
            <ScrollView
              contentContainerStyle={[styles.bottomScroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEnabled={isExpanded}
              onContentSizeChange={(_, h) => {
                setContentHeight(h)
                refreshExpandedHeight()
              }}
            >
              {/* Date & heure */}
              <View style={styles.sheetRow}>
                <TouchableOpacity style={[styles.dateButton, { flexDirection: 'row', gap: 6 }]} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={14} color="#374151" />
                  <Text style={styles.dateButtonText}>{formatDate(scheduledAt)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dateButton, { flexDirection: 'row', gap: 6 }]} onPress={() => setShowTimePicker(true)}>
                  <Ionicons name="time-outline" size={14} color="#374151" />
                  <Text style={styles.dateButtonText}>{formatTime(scheduledAt)}</Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker value={scheduledAt} mode="date" minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false)
                    if (date) setScheduledAt(prev => { const n = new Date(date); n.setHours(prev.getHours(), prev.getMinutes()); return n })
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker value={scheduledAt} mode="time"
                  onChange={(_, date) => {
                    setShowTimePicker(false)
                    if (date) setScheduledAt(prev => { const n = new Date(prev); n.setHours(date.getHours(), date.getMinutes()); return n })
                  }}
                />
              )}

              {/* Type de course — masqué en mode forfait */}
              {!isForfaitZone && (
                <View style={styles.sheetRow}>
                  <TouchableOpacity
                    style={[styles.tripTypeBtn, tripType === 'one_way' && styles.tripTypeBtnActive]}
                    onPress={() => setTripType('one_way')}
                  >
                    <Text style={[styles.tripTypeBtnText, tripType === 'one_way' && styles.tripTypeBtnTextActive]}>Aller simple</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tripTypeBtn, tripType === 'round_trip' && styles.tripTypeBtnActive]}
                    onPress={() => setTripType('round_trip')}
                  >
                    <Text style={[styles.tripTypeBtnText, tripType === 'round_trip' && styles.tripTypeBtnTextActive]}>Aller-retour</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Options */}
              <View style={styles.sheetDivider} />
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>Course conventionnée</Text>
                  <Text style={styles.optionHint}>Bon de transport CPAM requis</Text>
                </View>
                <Switch value={isConventional} onValueChange={setIsConventional}
                  trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }}
                  thumbColor={isConventional ? '#1D4ED8' : '#9CA3AF'} />
              </View>
              {isConventional && (
                <View style={styles.conventionalInfo}>
                  <Text style={styles.conventionalInfoText}>
                    Un bon de transport CPAM sera demandé par le chauffeur.
                  </Text>
                </View>
              )}

              <View style={[styles.optionRow, { marginTop: 12 }]}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>Gare ou aéroport</Text>
                  <Text style={styles.optionHint}>Forfait selon votre zone de départ</Text>
                </View>
                <Switch value={isForfaitZone} onValueChange={handleForfaitZoneToggle}
                  trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }}
                  thumbColor={isForfaitZone ? '#1D4ED8' : '#9CA3AF'} />
              </View>

              {/* Sélecteur gare/aéroport */}
              {isForfaitZone && (
                <>
                  <View style={styles.sheetDivider} />
                  <View style={styles.sheetRow}>
                    <TouchableOpacity
                      style={[styles.tripTypeBtn, forfaitDirection === 'to' && styles.tripTypeBtnActive]}
                      onPress={() => setForfaitDirection('to')}
                    >
                      <Text style={[styles.tripTypeBtnText, forfaitDirection === 'to' && styles.tripTypeBtnTextActive]}>Aller vers →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tripTypeBtn, forfaitDirection === 'from' && styles.tripTypeBtnActive]}
                      onPress={() => setForfaitDirection('from')}
                    >
                      <Text style={[styles.tripTypeBtnText, forfaitDirection === 'from' && styles.tripTypeBtnTextActive]}>← Venir de</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="train-outline" size={13} color="#6B7280" />
                    <Text style={[styles.forfaitGroupLabel, { marginBottom: 0 }]}>Gares</Text>
                  </View>
                  <View style={styles.forfaitsList}>
                    {destinations.filter(d => d.type === 'station').map(d => (
                      <TouchableOpacity key={d.name}
                        style={[styles.forfaitBtn, selectedDestination?.name === d.name && styles.forfaitBtnActive]}
                        onPress={() => setSelectedDestination(d)}
                      >
                        <Text style={[styles.forfaitBtnText, selectedDestination?.name === d.name && styles.forfaitBtnTextActive]}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 6 }}>
                    <Ionicons name="airplane-outline" size={13} color="#6B7280" />
                    <Text style={[styles.forfaitGroupLabel, { marginBottom: 0 }]}>Aéroports</Text>
                  </View>
                  <View style={styles.forfaitsList}>
                    {destinations.filter(d => d.type === 'airport').map(d => (
                      <TouchableOpacity key={d.name}
                        style={[styles.forfaitBtn, selectedDestination?.name === d.name && styles.forfaitBtnActive]}
                        onPress={() => setSelectedDestination(d)}
                      >
                        <Text style={[styles.forfaitBtnText, selectedDestination?.name === d.name && styles.forfaitBtnTextActive]}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {destinations.length === 0 && <Text style={styles.sectionHint}>Chargement des destinations…</Text>}
                </>
              )}

              {/* Bouton calculer */}
              <TouchableOpacity
                style={[styles.calculateBtn, loading && styles.disabledButton]}
                onPress={handleCalculate}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.calculateBtnText}>Calculer l'estimation →</Text>
                }
              </TouchableOpacity>

              {/* Bouton réduire */}
              {isExpanded && (
                <TouchableOpacity onPress={() => snapTo(false)} style={styles.collapseBtn}>
                  <Text style={styles.collapseBtnText}>⌄ Réduire</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const placesStyles = {
  container: { flex: 0 },
  textInputContainer: { backgroundColor: 'transparent' },
  textInput: {
    fontSize: 15,
    color: '#111827',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    height: 40,
  },
  listView: {
    position: 'absolute' as const,
    top: 42,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#FFF',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
}

const styles = StyleSheet.create({
  // ── Layout principal ──
  container: { flex: 1 },
  overlay: { flex: 1 },

  // ── Top section ──
  topSection: { paddingHorizontal: 16, paddingTop: 8, gap: 10, zIndex: 20 },
  greetingPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  greeting: { fontSize: 13, color: '#6B7280' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 2 },

  // ── Carte adresse ──
  locationCard: { zIndex: 20 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, flexShrink: 0 },
  dotBlue: { backgroundColor: '#1D4ED8' },
  dotGray: { backgroundColor: '#9CA3AF' },
  autocompleteWrapper: { flex: 1 },
  locationBtn: { marginLeft: 8, padding: 4 },
  locationBtnText: { fontSize: 20 },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 6, marginLeft: 22 },

  // ── Marqueurs carte ──
  markerPickup: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#1D4ED8',
    borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  markerPickupInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  markerDropoff: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  markerDropoffText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // ── Bottom sheet snap ──
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 16,
  },
  handleZone: { paddingTop: 10, paddingBottom: 4 },
  bottomHandle: {
    width: 36, height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 2, alignSelf: 'center', marginBottom: 10,
  },
  // Résumé compact — une seule ligne
  compactSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingBottom: 8,
  },
  compactLine: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
  compactChevron: { fontSize: 16, color: '#9CA3AF', marginLeft: 8 },
  bottomScroll: { gap: 12 },
  sheetRow: { flexDirection: 'row', gap: 8 },
  sheetDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 2 },
  // Bouton réduire
  collapseBtn: { alignItems: 'center', paddingVertical: 4 },
  collapseBtnText: { fontSize: 13, color: '#9CA3AF' },

  // ── Date buttons ──
  dateButton: {
    flex: 1, backgroundColor: '#F3F4F6',
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 10, alignItems: 'center',
  },
  dateButtonText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  // ── Type de course ──
  tripTypeBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  tripTypeBtnActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  tripTypeBtnText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  tripTypeBtnTextActive: { color: '#FFFFFF' },

  // ── Options ──
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionInfo: { flex: 1 },
  optionLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  optionHint: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  conventionalInfo: {
    padding: 12, backgroundColor: '#FFF7ED',
    borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  conventionalInfoText: { fontSize: 13, color: '#92400E', lineHeight: 18 },

  // ── Forfaits ──
  forfaitGroupLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  forfaitsList: { gap: 8 },
  forfaitBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  forfaitBtnActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  forfaitBtnText: { fontSize: 14, color: '#374151' },
  forfaitBtnTextActive: { color: '#FFFFFF' },
  forfaitPrice: { fontSize: 14, fontWeight: '600', color: '#374151' },
  sectionHint: { fontSize: 13, color: '#6B7280' },

  // ── CTA ──
  calculateBtn: {
    backgroundColor: '#1D4ED8', paddingVertical: 17,
    borderRadius: 14, alignItems: 'center', marginTop: 4,
  },
  disabledButton: { opacity: 0.6 },
  calculateBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
})
