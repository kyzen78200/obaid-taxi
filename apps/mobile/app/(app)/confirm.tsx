import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { supabase } from '../../lib/supabase'
import { useBookingStore } from '../../store/booking'
import { useAuthStore } from '../../store/auth'
import { useGuestHistoryStore } from '../../store/guestHistory'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const MAX_PDF_SIZE = 5 * 1024 * 1024 // 5 MB

export default function ConfirmScreen() {
  const router = useRouter()
  const { formData, estimate, reset } = useBookingStore()
  const { user, profile, isGuest } = useAuthStore()
  const { addBooking: addGuestBooking } = useGuestHistoryStore()

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // PDF attestation (course conventionnée)
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string; size: number } | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)

  useEffect(() => {
    if (!formData.pickup_address || !estimate) {
      router.replace('/(app)')
    }
  }, [])

  if (!formData.pickup_address || !estimate) return null

  async function pickPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      if (asset.size && asset.size > MAX_PDF_SIZE) {
        Alert.alert('Fichier trop volumineux', 'L\'attestation ne doit pas dépasser 5 Mo.')
        return
      }
      setPdfFile({ uri: asset.uri, name: asset.name, size: asset.size ?? 0 })
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier.')
    }
  }

  async function uploadPdf(bookingId: string): Promise<string | null> {
    if (!pdfFile) return null
    setUploadingPdf(true)
    try {
      const path = `${bookingId}/${pdfFile.name}`
      const response = await fetch(pdfFile.uri)
      const blob = await response.blob()

      const { error } = await supabase.storage
        .from('attestations')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true })

      if (error) {
        console.warn('PDF upload error:', error.message)
        return null
      }

      const { data } = supabase.storage.from('attestations').getPublicUrl(path)
      return data.publicUrl
    } catch (err) {
      console.warn('PDF upload failed:', err)
      return null
    } finally {
      setUploadingPdf(false)
    }
  }

  async function handleConfirm() {
    if (isGuest) {
      if (!guestName.trim() || !guestPhone.trim() || !guestEmail.trim()) {
        Alert.alert('Informations manquantes', 'Nom, téléphone et email sont requis pour confirmer.')
        return
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(guestEmail.trim())) {
        Alert.alert('Email invalide', 'Veuillez saisir une adresse email valide.')
        return
      }
    }

    setLoading(true)
    try {
      const bookingData = {
        client_id: user?.id ?? null,
        guest_name: isGuest ? guestName.trim() : null,
        guest_phone: isGuest ? guestPhone.trim() : null,
        guest_email: isGuest && guestEmail.trim() ? guestEmail.trim() : null,

        pickup_address: formData.pickup_address!,
        pickup_lat: formData.pickup_coords!.lat,
        pickup_lng: formData.pickup_coords!.lng,
        dropoff_address: formData.dropoff_address!,
        dropoff_lat: formData.dropoff_coords!.lat,
        dropoff_lng: formData.dropoff_coords!.lng,

        scheduled_at: new Date(formData.scheduled_at!).toISOString(),
        trip_type: formData.trip_type!,
        is_conventional: formData.is_conventional ?? false,
        forfait_id: formData.forfait_id ?? null,

        distance_km: estimate!.distance_km,
        duration_min: estimate!.duration_min,
        tariff_code: estimate!.tariff_code,
        base_price: estimate!.base_price,
        estimated_min: estimate!.estimated_min,
        estimated_max: estimate!.estimated_max,

        notes: notes.trim() || null,
        status: 'pending',
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select('id')
        .single()

      if (error) throw new Error(error.message)

      // Sauvegarde locale pour les invités (historique persistant)
      if (isGuest) {
        addGuestBooking({
          id: data.id,
          pickup_address: bookingData.pickup_address,
          dropoff_address: bookingData.dropoff_address,
          pickup_lat: bookingData.pickup_lat,
          pickup_lng: bookingData.pickup_lng,
          dropoff_lat: bookingData.dropoff_lat,
          dropoff_lng: bookingData.dropoff_lng,
          scheduled_at: bookingData.scheduled_at,
          trip_type: bookingData.trip_type!,
          estimated_min: bookingData.estimated_min,
          estimated_max: bookingData.estimated_max,
          distance_km: bookingData.distance_km,
          duration_min: bookingData.duration_min,
          status: 'pending',
          created_at: new Date().toISOString(),
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          guest_email: guestEmail.trim(),
          notes: notes.trim() || null,
          tariff_code: bookingData.tariff_code,
          is_conventional: bookingData.is_conventional,
        })
      }

      // Upload PDF attestation if provided
      if (pdfFile) {
        const attestationUrl = await uploadPdf(data.id)
        if (attestationUrl) {
          await supabase
            .from('bookings')
            .update({ attestation_url: attestationUrl })
            .eq('id', data.id)
        }
      }

      // Trigger email confirmation + admin in-app notification
      const adminUrl = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'http://localhost:3000'
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const token = sessionData.session?.access_token
        if (!token) return
        fetch(`${adminUrl}/api/notify/booking-created`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ bookingId: data.id }),
        }).catch(() => {})
      })

      reset()
      router.replace(`/(app)/booking/${data.id}`)
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible d\'envoyer la demande.')
    } finally {
      setLoading(false)
    }
  }

  const departureLabel = formData.scheduled_at
    ? format(new Date(formData.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })
    : ''

  const isSubmitting = loading || uploadingPdf

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Modifier</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirmer la course</Text>

          {/* Récapitulatif */}
          <View style={styles.summaryCard}>
            <SummaryRow icon="📍" label="Départ" value={formData.pickup_address!} />
            <SummaryRow icon="🏁" label="Arrivée" value={formData.dropoff_address!} />
            <SummaryRow icon="📅" label="Départ prévu" value={departureLabel} />
            <SummaryRow
              icon="🚗"
              label="Type"
              value={formData.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'}
            />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Estimation</Text>
              <Text style={styles.priceValue}>
                {estimate!.estimated_min}€ – {estimate!.estimated_max}€
              </Text>
            </View>
          </View>

          {/* Infos invité */}
          {isGuest && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Vos coordonnées</Text>
              <View style={styles.fields}>
                <Field
                  label="Nom complet *"
                  value={guestName}
                  onChange={setGuestName}
                  placeholder="Jean Dupont"
                  autoCapitalize="words"
                />
                <Field
                  label="Téléphone *"
                  value={guestPhone}
                  onChange={setGuestPhone}
                  placeholder="+33 6 12 34 56 78"
                  keyboardType="phone-pad"
                />
                <Field
                  label="Email *"
                  value={guestEmail}
                  onChange={setGuestEmail}
                  placeholder="votre@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.emailHint}>
                  💡 Permet de retrouver vos courses si vous créez un compte plus tard
                </Text>
              </View>
            </View>
          )}

          {/* Infos client connecté */}
          {!isGuest && profile && (
            <View style={styles.clientInfo}>
              <Text style={styles.clientInfoText}>
                👤 Réservation au nom de <Text style={styles.clientName}>{profile.full_name}</Text>
              </Text>
              <Text style={styles.clientPhone}>{profile.phone}</Text>
            </View>
          )}

          {/* Notes pour le chauffeur */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notes pour le chauffeur</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: bagages, enfant, adresse précise..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Attestation course conventionnée */}
          {formData.is_conventional && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>⚕️ Course conventionnée</Text>
              <Text style={styles.conventionalHint}>
                Munissez-vous de votre bon de transport CPAM. Vous pouvez joindre votre attestation PDF (recommandé).
              </Text>

              {pdfFile ? (
                <View style={styles.pdfAttached}>
                  <View style={styles.pdfInfo}>
                    <Text style={styles.pdfIcon}>📄</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pdfName} numberOfLines={1}>{pdfFile.name}</Text>
                      <Text style={styles.pdfSize}>{(pdfFile.size / 1024).toFixed(0)} Ko</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setPdfFile(null)} style={styles.pdfRemove}>
                    <Text style={styles.pdfRemoveText}>✕ Supprimer</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.pdfPickButton} onPress={pickPdf}>
                  <Text style={styles.pdfPickText}>📎 Joindre mon attestation PDF</Text>
                  <Text style={styles.pdfPickSub}>Max 5 Mo — Recommandé</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.confirmButton, isSubmitting && styles.disabledButton]}
            onPress={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.confirmButtonText}>Envoyer la demande</Text>
            }
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Votre demande sera examinée par le gestionnaire qui vous confirmera la course par email et notification.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <View style={styles.summaryContent}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  )
}

function Field({
  label, value, onChange, placeholder, keyboardType, autoCapitalize,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  keyboardType?: any
  autoCapitalize?: any
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 12 },
  backButton: { marginBottom: 8 },
  backText: { color: '#1D4ED8', fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 8 },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    gap: 12,
  },
  summaryRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  summaryIcon: { fontSize: 18, marginTop: 2 },
  summaryContent: { flex: 1 },
  summaryLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  summaryValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  priceLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  priceValue: { fontSize: 17, fontWeight: '700', color: '#1D4ED8' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 12 },
  fields: { gap: 12 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },

  clientInfo: {
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  clientInfoText: { fontSize: 14, color: '#1E40AF' },
  clientName: { fontWeight: '700' },
  clientPhone: { fontSize: 13, color: '#3B82F6', marginTop: 4 },

  notesInput: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB', minHeight: 80,
  },

  conventionalHint: {
    fontSize: 13, color: '#92400E', marginBottom: 12, lineHeight: 18,
  },

  // PDF picker
  pdfPickButton: {
    borderWidth: 1.5, borderColor: '#BFDBFE', borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center', backgroundColor: '#F8FAFF',
  },
  pdfPickText: { fontSize: 14, color: '#1D4ED8', fontWeight: '600' },
  pdfPickSub: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },

  pdfAttached: {
    borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 12,
    padding: 12, backgroundColor: '#ECFDF5',
  },
  pdfInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  pdfIcon: { fontSize: 22 },
  pdfName: { fontSize: 13, color: '#065F46', fontWeight: '600' },
  pdfSize: { fontSize: 11, color: '#6B7280' },
  pdfRemove: { alignSelf: 'flex-end' },
  pdfRemoveText: { fontSize: 12, color: '#EF4444', fontWeight: '500' },

  confirmButton: {
    backgroundColor: '#1D4ED8', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 8,
  },
  disabledButton: { opacity: 0.6 },
  confirmButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  disclaimer: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
  emailHint: { fontSize: 12, color: '#6B7280', lineHeight: 16, marginTop: -4 },
})
