import { useEffect, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useGuestHistoryStore, type GuestBookingRecord } from '../../store/guestHistory'
import type { Booking, BookingStatus } from '@obaid-taxi/shared'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUS_COLORS: Record<string, string> = {
  pending:                '#F59E0B',
  confirmed:              '#10B981',
  in_progress:            '#1D4ED8',
  completed:              '#3B82F6',
  refused:                '#EF4444',
  cancelled:              '#9CA3AF',
  no_show:                '#9CA3AF',
  cancellation_requested: '#D97706',
}

const STATUS_LABELS: Record<string, string> = {
  pending:                'En attente',
  confirmed:              'Confirmée',
  in_progress:            'En route',
  completed:              'Effectuée',
  refused:                'Refusée',
  cancelled:              'Annulée',
  no_show:                'Non présenté',
  cancellation_requested: 'Annulation demandée',
}

export default function HistoryScreen() {
  const router = useRouter()
  const { user, isGuest } = useAuthStore()
  const { bookings: guestBookings } = useGuestHistoryStore()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (isGuest) {
      setLoading(false)
      return
    }
    if (!user) {
      setLoading(false)
      return
    }
    loadHistory()
  }, [user, isGuest])

  async function loadHistory(isRefresh = false) {
    if (!isRefresh) setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('client_id', user!.id)
      .order('created_at', { ascending: false })

    setBookings(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadHistory(true)
  }

  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mes courses</Text>
          <Text style={styles.subtitle}>{guestBookings.length} course{guestBookings.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>
            Créez un compte pour retrouver vos courses sur tous vos appareils
          </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.guestBannerLink}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
        {guestBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="car-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>Aucune course pour l'instant</Text>
            <Text style={styles.emptySubtitle}>Réservez votre première course !</Text>
            <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/(app)')}>
              <Text style={styles.loginButtonText}>Réserver maintenant</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={guestBookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <GuestBookingCard booking={item} onPress={() => router.push(`/(app)/booking/${item.id}`)} />
            )}
          />
        )}
      </SafeAreaView>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes courses</Text>
        <Text style={styles.subtitle}>{bookings.length} course{bookings.length !== 1 ? 's' : ''}</Text>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚕</Text>
          <Text style={styles.emptyTitle}>Aucune course pour l'instant</Text>
          <Text style={styles.emptySubtitle}>Réservez votre première course !</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(app)')}
          >
            <Text style={styles.loginButtonText}>Réserver maintenant</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={() => router.push(`/(app)/booking/${item.id}`)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#1D4ED8']}
              tintColor="#1D4ED8"
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

function GuestBookingCard({ booking, onPress }: { booking: GuestBookingRecord; onPress: () => void }) {
  const date = format(new Date(booking.scheduled_at), "d MMM yyyy 'à' HH'h'mm", { locale: fr })
  const statusColor = STATUS_COLORS[booking.status] ?? '#9CA3AF'
  return (
    <TouchableOpacity style={styles.bookingCard} onPress={onPress}>
      <View style={styles.bookingHeader}>
        <View style={styles.route}>
          <View style={[styles.dot, styles.dotBlue]} />
          <Text style={styles.address} numberOfLines={1}>{booking.pickup_address}</Text>
        </View>
        <View style={styles.route}>
          <View style={[styles.dot, styles.dotGray]} />
          <Text style={styles.address} numberOfLines={1}>{booking.dropoff_address}</Text>
        </View>
      </View>
      <View style={styles.bookingFooter}>
        <Text style={styles.date}>{date}</Text>
        <View style={styles.bookingRight}>
          <Text style={styles.price}>{booking.estimated_min}€–{booking.estimated_max}€</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[booking.status] ?? booking.status}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const date = format(new Date(booking.scheduled_at), "d MMM yyyy 'à' HH'h'mm", { locale: fr })
  const statusColor = STATUS_COLORS[booking.status] ?? '#9CA3AF'

  return (
    <TouchableOpacity style={styles.bookingCard} onPress={onPress}>
      <View style={styles.bookingHeader}>
        <View style={styles.route}>
          <View style={[styles.dot, styles.dotBlue]} />
          <Text style={styles.address} numberOfLines={1}>{booking.pickup_address}</Text>
        </View>
        <View style={styles.route}>
          <View style={[styles.dot, styles.dotGray]} />
          <Text style={styles.address} numberOfLines={1}>{booking.dropoff_address}</Text>
        </View>
      </View>
      <View style={styles.bookingFooter}>
        <Text style={styles.date}>{date}</Text>
        <View style={styles.bookingRight}>
          <Text style={styles.price}>{booking.estimated_min}€–{booking.estimated_max}€</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[booking.status]}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 10 },

  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  bookingHeader: { gap: 6 },
  route: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotBlue: { backgroundColor: '#1D4ED8' },
  dotGray: { backgroundColor: '#9CA3AF' },
  address: { fontSize: 14, color: '#374151', flex: 1 },
  bookingFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: '#9CA3AF' },
  bookingRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 13, fontWeight: '600', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  loginButton: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  guestBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  guestBannerText: { fontSize: 13, color: '#1E40AF', flex: 1 },
  guestBannerLink: { fontSize: 13, color: '#1D4ED8', fontWeight: '700', textDecorationLine: 'underline' },
})
