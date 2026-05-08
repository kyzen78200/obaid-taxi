import { useEffect, useState, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Dimensions, Modal, Linking, RefreshControl,
} from 'react-native'
import MapView, { Marker, Polyline, MapStyleElement } from 'react-native-maps'

const MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry',            stylers: [{ color: '#f2f2f2' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#717171' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#f2f2f2' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
  { featureType: 'road',       elementType: 'geometry',          stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',       elementType: 'geometry.stroke',   stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road.highway', elementType: 'geometry',        stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d0d0d0' }] },
  { featureType: 'water',      elementType: 'geometry',          stylers: [{ color: '#c8d8e8' }] },
  { featureType: 'landscape',  elementType: 'geometry',          stylers: [{ color: '#ebebeb' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
]
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { getRouteInfo } from '../../../lib/google-maps'
import { decodePolyline } from '../../../lib/decode-polyline'
import { useAuthStore } from '../../../store/auth'
import { useGuestHistoryStore } from '../../../store/guestHistory'
import type { BookingWithDriver, BookingStatus } from '@obaid-taxi/shared'
import { canCancel } from '@obaid-taxi/shared'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.38)

const CANCELLATION_REASONS = [
  { id: 'price',    label: 'Prix trop élevé' },
  { id: 'no_need',  label: 'Je n\'ai plus besoin du trajet' },
  { id: 'wrong_pickup', label: 'Mauvais point de prise en charge' },
  { id: 'other_solution', label: 'J\'ai trouvé une autre solution' },
  { id: 'mistake',  label: 'Réservation créée par erreur' },
  { id: 'other',    label: 'Autre (préciser)' },
]

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:                { label: 'En attente',             color: '#B45309', bg: '#FFF7ED', icon: 'time-outline' },
  confirmed:              { label: 'Confirmée',              color: '#065F46', bg: '#ECFDF5', icon: 'checkmark-circle-outline' },
  in_progress:            { label: 'En route',               color: '#1D4ED8', bg: '#EFF6FF', icon: 'car-outline' },
  completed:              { label: 'Effectuée',              color: '#1E40AF', bg: '#EFF6FF', icon: 'star-outline' },
  refused:                { label: 'Refusée',                color: '#991B1B', bg: '#FEF2F2', icon: 'close-circle-outline' },
  cancelled:              { label: 'Annulée',                color: '#6B7280', bg: '#F9FAFB', icon: 'ban-outline' },
  no_show:                { label: 'Non présenté',           color: '#6B7280', bg: '#F9FAFB', icon: 'person-remove-outline' },
  cancellation_requested: { label: 'Annulation demandée',   color: '#92400E', bg: '#FFFBEB', icon: 'alert-circle-outline' },
}

export default function BookingStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const { isGuest } = useAuthStore()
  const { bookings: guestBookings, updateStatus: updateGuestStatus } = useGuestHistoryStore()

  const [booking, setBooking] = useState<BookingWithDriver | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [polylineCoords, setPolylineCoords] = useState<{ latitude: number; longitude: number }[]>([])

  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  // 2h deadline modal
  const [showDeadlineModal, setShowDeadlineModal] = useState(false)
  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!id) return

    // Invité : charger depuis le store local uniquement
    if (isGuest) {
      const local = guestBookings.find((b) => b.id === id)
      if (local) {
        setBooking(local as unknown as BookingWithDriver)
      } else {
        Alert.alert('Erreur', 'Réservation introuvable.')
        router.back()
      }
      setLoading(false)
      return
    }

    loadBooking()

    const channel = supabase
      .channel(`booking-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` },
        (payload) => setBooking(payload.new as BookingWithDriver))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, isGuest])

  async function handleRefresh() {
    setRefreshing(true)
    await loadBooking()
    setRefreshing(false)
  }

  async function loadBooking() {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, drivers(id, first_name, last_name, phone)')
      .eq('id', id)
      .single()

    if (error) {
      Alert.alert('Erreur', 'Réservation introuvable.')
      router.back()
      return
    }
    setBooking(data)
    setLoading(false)

    try {
      const route = await getRouteInfo(
        { lat: data.pickup_lat, lng: data.pickup_lng },
        { lat: data.dropoff_lat, lng: data.dropoff_lng }
      )
      setPolylineCoords(decodePolyline(route.encoded_polyline))
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: data.pickup_lat, longitude: data.pickup_lng },
            { latitude: data.dropoff_lat, longitude: data.dropoff_lng },
          ],
          { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true }
        )
      }, 400)
    } catch (err) {
      console.error('[polyline fetch]', err)
    }
  }

  // canCancel() importé depuis @obaid-taxi/shared — voir packages/shared/src/booking-rules.ts

  function openCancelModal() {
    if (!booking) return
    if (booking.status === 'confirmed') {
      const twoHoursMs = 2 * 60 * 60 * 1000
      const remaining = new Date(booking.scheduled_at).getTime() - Date.now()
      if (remaining < twoHoursMs) {
        setShowDeadlineModal(true)
        return
      }
    }
    setSelectedReason(null)
    setOtherText('')
    setShowCancelModal(true)
  }

  async function confirmCancel() {
    if (!selectedReason) {
      Alert.alert('Motif requis', 'Veuillez sélectionner un motif d\'annulation.')
      return
    }
    const reason = selectedReason === 'other' && otherText.trim()
      ? `Autre : ${otherText.trim()}`
      : CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label ?? selectedReason

    setCancelling(true)
    setShowCancelModal(false)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .eq('id', id)
      .in('status', ['pending', 'confirmed'])

    if (error) {
      Alert.alert('Erreur', 'Impossible d\'annuler la course.')
    } else {
      // Mettre à jour le store local pour les invités
      if (isGuest) {
        updateGuestStatus(id as string, 'cancelled')
        setBooking((prev) => prev ? { ...prev, status: 'cancelled', cancellation_reason: reason } : prev)
      }
    }
    setCancelling(false)
  }

  function handleRepeatBooking() {
    if (!booking) return
    router.push({
      pathname: '/(app)',
      params: {
        prefill_pickup: booking.pickup_address,
        prefill_pickup_lat: String(booking.pickup_lat),
        prefill_pickup_lng: String(booking.pickup_lng),
        prefill_dropoff: booking.dropoff_address,
        prefill_dropoff_lat: String(booking.dropoff_lat),
        prefill_dropoff_lng: String(booking.dropoff_lng),
        prefill_trip_type: booking.trip_type,
      },
    })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    )
  }

  if (!booking) return null

  const statusConfig = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG['pending']
  const scheduledDate = format(new Date(booking.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })
  const createdDate = format(new Date(booking.created_at), 'd MMM yyyy', { locale: fr })

  const pickupCoord  = { latitude: booking.pickup_lat,  longitude: booking.pickup_lng }
  const dropoffCoord = { latitude: booking.dropoff_lat, longitude: booking.dropoff_lng }

  const showCancelBtn = canCancel(booking.status, booking.scheduled_at)
  const isTerminal = ['completed', 'cancelled', 'refused', 'no_show'].includes(booking.status)

  return (
    <View style={styles.container}>
      {/* ── Carte ── */}
      <View style={[styles.mapContainer, { height: MAP_HEIGHT }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: (pickupCoord.latitude + dropoffCoord.latitude) / 2,
            longitude: (pickupCoord.longitude + dropoffCoord.longitude) / 2,
            latitudeDelta: 0.3,
            longitudeDelta: 0.3,
          }}
          customMapStyle={MAP_STYLE}
        >
          {polylineCoords.length > 0 && (
            <Polyline coordinates={polylineCoords} strokeColor="#1D4ED8" strokeWidth={4} />
          )}
          <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerPickup}>
              <View style={styles.markerPickupInner} />
            </View>
          </Marker>
          <Marker coordinate={dropoffCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.markerDropoff}>
              <Text style={styles.markerDropoffText}>B</Text>
            </View>
          </Marker>
        </MapView>

        <TouchableOpacity
          style={[styles.floatingBack, { top: insets.top + 12 }]}
          onPress={() => router.push('/(app)')}
        >
          <Text style={styles.floatingBackText}>← Accueil</Text>
        </TouchableOpacity>

        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Ionicons name={statusConfig.icon as any} size={16} color={statusConfig.color} />
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* ── Contenu ── */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D4ED8" />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Votre réservation</Text>
          <Text style={styles.bookingId}>#{booking.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        {/* ── Messages contextuels ── */}
        {booking.status === 'pending' && (
          <View style={[styles.statusCard, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusHint, { color: statusConfig.color }]}>
              Le gestionnaire va examiner votre demande et vous confirmera par notification.
            </Text>
          </View>
        )}
        {booking.status === 'confirmed' && (
          <View style={[styles.statusCard, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusHint, { color: statusConfig.color }]}>
              Votre course est confirmée. Le chauffeur sera à l'heure !
            </Text>
          </View>
        )}
        {booking.status === 'in_progress' && (
          <View style={[styles.statusCard, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusHint, { color: statusConfig.color }]}>
              Le chauffeur est en route pour vous récupérer.
            </Text>
          </View>
        )}
        {booking.status === 'cancellation_requested' && (
          <View style={[styles.statusCard, { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' }]}>
            <Text style={{ color: '#92400E', fontSize: 13 }}>
              Le chauffeur a demandé l'annulation de cette course. Le gestionnaire examine la demande.
            </Text>
          </View>
        )}
        {booking.status === 'refused' && (
          <View style={[styles.statusCard, { backgroundColor: '#FEF2F2' }]}>
            <Text style={{ color: '#991B1B', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
              Votre réservation a été refusée.
            </Text>
            {booking.refusal_comment ? (
              <Text style={{ color: '#7F1D1D', fontSize: 13 }}>
                Motif : {booking.refusal_comment}
              </Text>
            ) : null}
          </View>
        )}
        {booking.status === 'cancelled' && booking.cancellation_reason && (
          <View style={[styles.statusCard, { backgroundColor: '#F9FAFB' }]}>
            <Text style={{ color: '#6B7280', fontSize: 13 }}>
              Annulée — {booking.cancellation_reason}
            </Text>
          </View>
        )}
        {booking.status === 'completed' && booking.points_credited ? (
          <View style={[styles.statusCard, { backgroundColor: '#FFFBEB' }]}>
            <Text style={{ color: '#92400E', fontSize: 13 }}>
              +{booking.points_credited} points fidélité crédités !
            </Text>
          </View>
        ) : null}

        {/* ── Infos chauffeur (si confirmée ou en route) ── */}
        {(booking.status === 'confirmed' || booking.status === 'in_progress') && booking.drivers && (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#1D4ED8' }]}>
            <Text style={styles.sectionTitle}>Votre chauffeur</Text>
            <DetailRow icon="person-outline" label="Nom"      value={`${booking.drivers.first_name} ${booking.drivers.last_name}`} />
            {booking.drivers.phone && (
              <DetailRow icon="call-outline" label="Téléphone" value={booking.drivers.phone} />
            )}
          </View>
        )}

        {/* ── Timeline ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Suivi</Text>
          <TimelineStep icon="document-text-outline" label="Demande envoyée" sublabel={createdDate} done />
          <TimelineStep
            icon="checkmark-circle-outline" label="Confirmation"
            sublabel={booking.status !== 'pending' && booking.status !== 'refused' ? 'Traitée' : booking.status === 'refused' ? 'Refusée' : 'En cours...'}
            done={!['pending', 'refused'].includes(booking.status)}
            active={booking.status === 'pending'}
          />
          <TimelineStep
            icon="car-outline" label="En route" sublabel=""
            done={['in_progress', 'completed'].includes(booking.status)}
            active={booking.status === 'confirmed'}
          />
          <TimelineStep
            icon="star-outline" label="Course effectuée" sublabel={scheduledDate}
            done={booking.status === 'completed'}
            active={booking.status === 'in_progress'}
            isLast
          />
        </View>

        {/* ── Détails ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Détails</Text>
          <DetailRow icon="location-outline" label="Départ"  value={booking.pickup_address} />
          <DetailRow icon="flag-outline" label="Arrivée" value={booking.dropoff_address} />
          <DetailRow icon="calendar-outline" label="Date"    value={scheduledDate} />
          <DetailRow icon="car-outline" label="Type"    value={booking.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'} />
          <DetailRow
            icon="cash-outline" label="Estimation"
            value={booking.estimated_min === booking.estimated_max
              ? `${booking.estimated_min}€ (forfait)`
              : `${booking.estimated_min}€ – ${booking.estimated_max}€`}
          />
          <DetailRow icon="resize-outline" label="Distance" value={`${booking.distance_km.toFixed(1)} km`} />
          {booking.notes && <DetailRow icon="document-text-outline" label="Notes" value={booking.notes} />}
        </View>

        {/* ── Actions ── */}
        {showCancelBtn && (
          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.disabledButton]}
            onPress={openCancelModal}
            disabled={cancelling}
          >
            {cancelling
              ? <ActivityIndicator color="#EF4444" />
              : <Text style={styles.cancelButtonText}>Annuler cette course</Text>
            }
          </TouchableOpacity>
        )}

        {booking.status === 'completed' && (
          <TouchableOpacity style={[styles.repeatButton, { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }]} onPress={handleRepeatBooking}>
            <Ionicons name="refresh-outline" size={15} color="#1D4ED8" />
            <Text style={styles.repeatButtonText}>Reprendre ce trajet</Text>
          </TouchableOpacity>
        )}

        {isTerminal && booking.status !== 'completed' && (
          <TouchableOpacity style={styles.newBookingButton} onPress={() => router.push('/(app)')}>
            <Text style={styles.newBookingButtonText}>Faire une nouvelle réservation</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modal délai 2h dépassé ── */}
      <Modal
        visible={showDeadlineModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeadlineModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Annulation impossible</Text>
            <Text style={[styles.modalSubtitle, { marginBottom: 20 }]}>
              Votre course est dans moins de 2 heures et ne peut plus être annulée en ligne.
            </Text>

            {booking.drivers ? (
              <View style={styles.driverContactBox}>
                <Text style={styles.driverContactLabel}>Contactez votre chauffeur directement :</Text>
                <Text style={styles.driverContactName}>
                  {booking.drivers.first_name} {booking.drivers.last_name}
                </Text>
                {booking.drivers.phone && (
                  <TouchableOpacity
                    style={[styles.callButton, { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }]}
                    onPress={() => Linking.openURL(`tel:${booking.drivers.phone}`)}
                  >
                    <Ionicons name="call-outline" size={15} color="#fff" />
                    <Text style={styles.callButtonText}>
                      Appeler {booking.drivers.phone}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={[styles.driverContactBox, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ color: '#92400E', fontSize: 13 }}>
                  Contactez-nous directement par téléphone pour annuler cette course.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalBtnCancel, { marginTop: 20 }]}
              onPress={() => setShowDeadlineModal(false)}
            >
              <Text style={styles.modalBtnCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal annulation ── */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Motif d'annulation</Text>
            <Text style={styles.modalSubtitle}>Pourquoi souhaitez-vous annuler ?</Text>

            {CANCELLATION_REASONS.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.reasonRow, selectedReason === r.id && styles.reasonRowSelected]}
                onPress={() => setSelectedReason(r.id)}
              >
                <View style={[styles.radioOuter, selectedReason === r.id && styles.radioOuterSelected]}>
                  {selectedReason === r.id && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.reasonLabel, selectedReason === r.id && styles.reasonLabelSelected]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}

            {selectedReason === 'other' && (
              <TextInput
                style={styles.otherTextInput}
                placeholder="Précisez votre motif d'annulation..."
                placeholderTextColor="#9CA3AF"
                value={otherText}
                onChangeText={setOtherText}
                multiline
                maxLength={200}
                autoFocus
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, (!selectedReason || (selectedReason === 'other' && !otherText.trim())) && styles.disabledButton]}
                onPress={confirmCancel}
                disabled={!selectedReason || (selectedReason === 'other' && !otherText.trim())}
              >
                <Text style={styles.modalBtnConfirmText}>Confirmer l'annulation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function TimelineStep({ icon, label, sublabel, done, active, isLast }: {
  icon: string; label: string; sublabel: string; done?: boolean; active?: boolean; isLast?: boolean
}) {
  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineLeft}>
        <View style={[styles.timelineDot, done && styles.timelineDotDone, active && styles.timelineDotActive]}>
          <Ionicons name={done ? 'checkmark' : icon as any} size={14} color={done ? '#fff' : '#6B7280'} />
        </View>
        {!isLast && <View style={[styles.timelineLine, done && styles.timelineLineDone]} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>{label}</Text>
        {sublabel ? <Text style={styles.timelineSublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  )
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={16} color="#6B7280" style={{ marginTop: 2 }} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },

  // ── Carte ──
  mapContainer: { width: '100%', overflow: 'hidden' },
  floatingBack: {
    position: 'absolute', left: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  floatingBackText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  statusBadge: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  statusBadgeIcon: { fontSize: 14 },
  statusBadgeText: { fontSize: 13, fontWeight: '600' },

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

  // ── Sheet ──
  sheet: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  bookingId: { fontSize: 13, color: '#9CA3AF' },

  statusCard: { borderRadius: 12, padding: 14 },
  statusHint: { fontSize: 13, lineHeight: 18 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 16 },

  timelineStep: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 36 },
  timelineDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  timelineDotDone: { backgroundColor: '#DCFCE7' },
  timelineDotActive: { backgroundColor: '#DBEAFE' },
  timelineIcon: { fontSize: 14 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  timelineLineDone: { backgroundColor: '#86EFAC' },
  timelineContent: { flex: 1, paddingBottom: 20 },
  timelineLabel: { fontSize: 14, fontWeight: '500', color: '#6B7280', marginBottom: 2 },
  timelineLabelDone: { color: '#111827' },
  timelineSublabel: { fontSize: 12, color: '#9CA3AF' },

  detailRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  detailIcon: { fontSize: 16, marginTop: 2 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500' },

  cancelButton: {
    borderWidth: 1, borderColor: '#EF4444',
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  cancelButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
  repeatButton: {
    backgroundColor: '#EFF6FF', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  repeatButtonText: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  newBookingButton: { backgroundColor: '#1D4ED8', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  newBookingButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },

  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 4,
    backgroundColor: '#F9FAFB',
  },
  reasonRowSelected: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: '#1D4ED8' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D4ED8' },
  reasonLabel: { fontSize: 14, color: '#374151', flex: 1 },
  reasonLabelSelected: { color: '#1D4ED8', fontWeight: '500' },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  modalBtnCancelText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  modalBtnConfirm: {
    flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  modalBtnConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // ── Deadline modal – driver contact ──
  driverContactBox: {
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: '#BFDBFE',
  },
  driverContactLabel: {
    fontSize: 11, color: '#3B82F6', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  driverContactName: {
    fontSize: 17, color: '#1D4ED8', fontWeight: '700', marginBottom: 12,
  },
  callButton: {
    backgroundColor: '#1D4ED8', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center',
  },
  callButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // ── Autre reason text input ──
  otherTextInput: {
    borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#111827', backgroundColor: '#F8FAFF',
    minHeight: 80, textAlignVertical: 'top',
    marginTop: 4, marginBottom: 4,
  },
})
