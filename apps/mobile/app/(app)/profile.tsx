import { useEffect, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, profile, isGuest, signOut, setProfile } = useAuthStore()
  const { isDark, theme, setTheme } = useTheme()
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (user && profile) {
      loadLoyaltyHistory()
    }
  }, [user, profile])

  async function loadLoyaltyHistory() {
    const { data } = await supabase
      .from('loyalty_transactions')
      .select('*, bookings(pickup_address, dropoff_address, scheduled_at)')
      .eq('client_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setLoyaltyTransactions(data ?? [])
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      // Recharger le profil (points de fidélité mis à jour)
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()
      if (freshProfile) setProfile(freshProfile)
      await loadLoyaltyHistory()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSignOut() {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          setLoading(true)
          await signOut()
          router.replace('/(auth)/welcome')
        },
      },
    ])
  }

  const bg = isDark ? '#111827' : '#F9FAFB'
  const cardBg = isDark ? '#1F2937' : '#FFFFFF'
  const textPrimary = isDark ? '#F9FAFB' : '#111827'
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280'
  const divider = isDark ? '#374151' : '#F3F4F6'

  if (isGuest) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#D1D5DB" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>Pas encore de compte</Text>
          <Text style={styles.emptySubtitle}>
            Créez un compte pour accéder à votre profil, votre historique et vos points fidélité
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.primaryButtonText}>Créer un compte</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1D4ED8']}
            tintColor="#1D4ED8"
          />
        }
      >
        {/* Header profil */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={[styles.fullName, { color: textPrimary }]}>{profile?.full_name}</Text>
          <Text style={[styles.email, { color: textSecondary }]}>{user?.email}</Text>
          {profile?.phone && <Text style={[styles.phone, { color: textSecondary }]}>{profile.phone}</Text>}
        </View>

        {/* Points fidélité */}
        <View style={[styles.loyaltyCard, isDark && { backgroundColor: '#1C1810', borderColor: '#78350F' }]}>
          <View style={styles.loyaltyHeader}>
            <Text style={styles.loyaltyTitle}>Points fidélité</Text>
            <Text style={styles.loyaltyPoints}>{profile?.loyalty_points ?? 0} pts</Text>
          </View>
          <Text style={styles.loyaltyHint}>
            1 point par km effectué · Points crédités après chaque course
          </Text>

          {loyaltyTransactions.length > 0 && (
            <View style={styles.transactionsList}>
              <Text style={styles.transactionsTitle}>Derniers mouvements</Text>
              {loyaltyTransactions.slice(0, 5).map(tx => (
                <View key={tx.id} style={styles.transactionRow}>
                  <Text style={styles.transactionLabel} numberOfLines={1}>
                    {tx.bookings?.pickup_address?.split(',')[0]} → {tx.bookings?.dropoff_address?.split(',')[0]}
                  </Text>
                  <Text style={[
                    styles.transactionPoints,
                    { color: tx.type === 'earned' ? '#059669' : '#EF4444' },
                  ]}>
                    {tx.type === 'earned' ? '+' : '-'}{tx.points} pts
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Menu */}
        <View style={[styles.menuCard, { backgroundColor: cardBg }]}>
          <MenuItem
            icon="time-outline"
            label="Mes réservations"
            onPress={() => router.push('/(app)/history')}
            textColor={textPrimary}
            dividerColor={divider}
          />
          <View style={[styles.menuDivider, { backgroundColor: divider }]} />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            onPress={() => {}}
            textColor={textPrimary}
            dividerColor={divider}
          />
          <View style={[styles.menuDivider, { backgroundColor: divider }]} />
          <MenuItem
            icon="settings-outline"
            label="Gérer mon compte"
            onPress={() => router.push('/(app)/account')}
            textColor={textPrimary}
            dividerColor={divider}
          />
          <View style={[styles.menuDivider, { backgroundColor: divider }]} />
          {/* Dark mode toggle */}
          <View style={styles.menuItem}>
            <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={textPrimary} style={{ width: 24 }} />
            <Text style={[styles.menuItemLabel, { color: textPrimary }]}>Mode sombre</Text>
            <Switch
              value={isDark}
              onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
              trackColor={{ false: '#D1D5DB', true: '#1D4ED8' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Déconnexion */}
        <TouchableOpacity
          style={[styles.signOutButton, loading && styles.disabledButton, isDark && { backgroundColor: '#2D1B1B', borderColor: '#7F1D1D' }]}
          onPress={handleSignOut}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#EF4444" />
            : <Text style={styles.signOutText}>Se déconnecter</Text>
          }
        </TouchableOpacity>

        <Text style={[styles.version, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>Obaid Taxi v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function MenuItem({ icon, label, onPress, textColor, dividerColor }: {
  icon: string
  label: string
  onPress: () => void
  textColor?: string
  dividerColor?: string
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={textColor ?? '#111827'} style={{ width: 24 }} />
      <Text style={[styles.menuItemLabel, textColor ? { color: textColor } : {}]}>{label}</Text>
      <Text style={[styles.menuItemArrow, dividerColor ? { color: dividerColor } : {}]}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, gap: 16 },

  profileHeader: { alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  fullName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  phone: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },

  loyaltyCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  loyaltyTitle: { fontSize: 15, fontWeight: '600', color: '#92400E' },
  loyaltyPoints: { fontSize: 18, fontWeight: '700', color: '#1D4ED8' },
  loyaltyHint: { fontSize: 12, color: '#B45309' },
  transactionsList: { marginTop: 12, gap: 8 },
  transactionsTitle: { fontSize: 12, fontWeight: '600', color: '#92400E', marginBottom: 4 },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  transactionLabel: { fontSize: 13, color: '#374151', flex: 1 },
  transactionPoints: { fontSize: 13, fontWeight: '600' },

  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuItemIcon: { fontSize: 18, width: 24 },
  menuItemLabel: { flex: 1, fontSize: 15, color: '#111827' },
  menuItemArrow: { fontSize: 20, color: '#D1D5DB' },
  menuDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 52 },

  signOutButton: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  disabledButton: { opacity: 0.6 },
  signOutText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  secondaryButtonText: { color: '#1D4ED8', fontSize: 15 },
})
