import { useState, useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Pressable, Dimensions,
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
import { useRouter } from 'expo-router'
import { useBookingStore } from '../../store/booking'
import { useAuthStore } from '../../store/auth'
import { calculateLoyaltyPoints } from '@obaid-taxi/shared'
import { decodePolyline } from '../../lib/decode-polyline'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.42)

const TARIFF_LABELS: Record<string, string> = {
  A: 'Aller-retour · Jour',
  B: 'Aller-retour · Nuit',
  C: 'Aller simple · Jour',
  D: 'Aller simple · Nuit',
}

export default function EstimateScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)

  const { formData, estimate, routePolyline } = useBookingStore()
  const { profile, session } = useAuthStore()
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    if (!estimate || !formData.scheduled_at) {
      router.back()
    }
  }, [])

  // Zoom sur le tracé une fois la carte rendue
  useEffect(() => {
    if (!formData.pickup_coords || !formData.dropoff_coords) return
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: formData.pickup_coords!.lat, longitude: formData.pickup_coords!.lng },
          { latitude: formData.dropoff_coords!.lat, longitude: formData.dropoff_coords!.lng },
        ],
        { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true }
      )
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  if (!estimate || !formData.scheduled_at) return null

  const polylineCoords = routePolyline ? decodePolyline(routePolyline) : []
  const pickupCoord  = { latitude: formData.pickup_coords!.lat,  longitude: formData.pickup_coords!.lng }
  const dropoffCoord = { latitude: formData.dropoff_coords!.lat, longitude: formData.dropoff_coords!.lng }

  const loyaltyPoints = calculateLoyaltyPoints(estimate.distance_km)
  const departureLabel = format(new Date(formData.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })

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
          {/* Tracé du trajet */}
          {polylineCoords.length > 0 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor="#1D4ED8"
              strokeWidth={4}
            />
          )}

          {/* Marqueur départ */}
          <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerPickup}>
              <View style={styles.markerPickupInner} />
            </View>
          </Marker>

          {/* Marqueur arrivée */}
          <Marker coordinate={dropoffCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.markerDropoff}>
              <Text style={styles.markerDropoffText}>B</Text>
            </View>
          </Marker>
        </MapView>

        {/* Bouton retour flottant */}
        <TouchableOpacity
          style={[styles.floatingBack, { top: insets.top + 12 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.floatingBackText}>← Modifier</Text>
        </TouchableOpacity>

        {/* Badge durée / distance */}
        <View style={[styles.routeBadge, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          <Ionicons name="car-outline" size={13} color="#FFFFFF" />
          <Text style={styles.routeBadgeText}>
            {estimate.duration_min} min · {estimate.distance_km.toFixed(1)} km
          </Text>
        </View>
      </View>

      {/* ── Contenu ── */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Prix principal */}
        <View style={styles.priceCard}>
          {estimate.is_forfait ? (
            <>
              <Text style={styles.priceLabel}>Prix forfaitaire</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceMin}>{estimate.estimated_min}€</Text>
              </View>
              <Text style={styles.priceNote}>Prix fixe · Paiement à bord</Text>
            </>
          ) : (
            <>
              <Text style={styles.priceLabel}>Votre course coûtera environ</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceMin}>{estimate.estimated_min}€</Text>
                <Text style={styles.priceSeparator}> – </Text>
                <Text style={styles.priceMax}>{estimate.estimated_max}€</Text>
              </View>
              <Text style={styles.priceNote}>Estimation indicative · Paiement à bord</Text>
            </>
          )}
        </View>

        {/* Détail du tarif */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Détail du tarif</Text>
          <DetailRow
            label="Itinéraire"
            value={estimate.is_forfait ? `Forfait : ${estimate.forfait_name}` : TARIFF_LABELS[estimate.tariff_code]}
          />
          {!estimate.is_forfait && (
            <>
              <DetailRow label="Distance estimée" value={`${estimate.distance_km.toFixed(1)} km`} />
              <DetailRow label="Durée estimée" value={`${estimate.duration_min} min`} />
              <DetailRow label="Prise en charge" value="2,94 €" />
            </>
          )}
          <DetailRow label="Départ prévu" value={departureLabel} />
          <DetailRow
            label="Type de course"
            value={formData.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'}
          />
          {formData.is_conventional && (
            <View style={[styles.conventionalBadge, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <Ionicons name="medical-outline" size={13} color="#065F46" />
              <Text style={styles.conventionalBadgeText}>
                Course conventionnée · Bon de transport requis
              </Text>
            </View>
          )}
        </View>

        {/* Points fidélité */}
        {profile && (
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyRow}>
              <Ionicons name="star-outline" size={22} color="#F59E0B" />
              <View style={styles.loyaltyTextBlock}>
                <Text style={styles.loyaltyTitle}>+{loyaltyPoints} points fidélité</Text>
                <Text style={styles.loyaltySubtitle}>
                  À gagner si effectuée · Solde : {profile.loyalty_points} pts
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Paiement */}
        <View style={styles.paymentCard}>
          <Text style={styles.paymentLabel}>Mode de paiement</Text>
          <Text style={styles.paymentValue}>Paiement directement au chauffeur</Text>
          <Text style={styles.paymentNote}>Espèces ou carte bancaire acceptées</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.reserveButton}
          onPress={() => {
            if (session) {
              router.push('/(app)/confirm')
            } else {
              setShowAuthModal(true)
            }
          }}
        >
          <Text style={styles.reserveButtonText}>Réserver cette course</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          * Le prix final peut varier légèrement selon les conditions de circulation réelles.
        </Text>
      </ScrollView>

      {/* Modal authentification */}
      <Modal
        visible={showAuthModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAuthModal(false)}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Confirmez votre identité</Text>
            <Text style={styles.modalSubtitle}>
              Connectez-vous pour finaliser votre réservation et suivre vos courses
            </Text>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => { setShowAuthModal(false); router.push('/(auth)/login?returnTo=estimate') }}
            >
              <Text style={styles.modalPrimaryBtnText}>Se connecter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => { setShowAuthModal(false); router.push('/(auth)/register?returnTo=estimate') }}
            >
              <Text style={styles.modalSecondaryBtnText}>Créer un compte</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalGhostBtn}
              onPress={() => { setShowAuthModal(false); router.push('/(app)/confirm') }}
            >
              <Text style={styles.modalGhostBtnText}>Continuer sans compte</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // ── Carte ──
  mapContainer: { width: '100%', overflow: 'hidden' },
  floatingBack: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingBackText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  routeBadge: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  routeBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Marqueurs
  markerPickup: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1D4ED8',
    borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  markerPickupInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  markerDropoff: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  markerDropoffText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // ── Sheet ──
  sheet: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  priceCard: {
    backgroundColor: '#1D4ED8',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  priceLabel: { color: '#BFDBFE', fontSize: 14, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceMin: { color: '#FFFFFF', fontSize: 42, fontWeight: '800' },
  priceSeparator: { color: '#93C5FD', fontSize: 28 },
  priceMax: { color: '#BFDBFE', fontSize: 36, fontWeight: '600' },
  priceNote: { color: '#93C5FD', fontSize: 13, marginTop: 8 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 12 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 16,
  },
  detailLabel: { fontSize: 14, color: '#6B7280', flex: 1 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500', flex: 1, textAlign: 'right' },

  conventionalBadge: {
    marginTop: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  conventionalBadgeText: { fontSize: 13, color: '#92400E' },

  loyaltyCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  loyaltyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loyaltyIcon: { fontSize: 28, flexShrink: 0 },
  loyaltyTextBlock: { flex: 1, minWidth: 0 },
  loyaltyTitle: { fontSize: 15, fontWeight: '600', color: '#92400E' },
  loyaltySubtitle: { fontSize: 13, color: '#B45309', marginTop: 2, flexWrap: 'wrap' },

  paymentCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  paymentLabel: { fontSize: 15, fontWeight: '600', color: '#166534', marginBottom: 4 },
  paymentValue: { fontSize: 14, color: '#166534' },
  paymentNote: { fontSize: 12, color: '#4ADE80', marginTop: 4 },

  reserveButton: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  reserveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  disclaimer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },

  // Modal auth
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 2, alignSelf: 'center', marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  modalPrimaryBtn: { backgroundColor: '#1D4ED8', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  modalPrimaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  modalSecondaryBtn: {
    backgroundColor: '#EFF6FF', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  modalSecondaryBtnText: { color: '#1D4ED8', fontSize: 16, fontWeight: '600' },
  modalGhostBtn: { paddingVertical: 12, alignItems: 'center' },
  modalGhostBtnText: { color: '#9CA3AF', fontSize: 14, textDecorationLine: 'underline' },
})
