import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { useAuthStore } from '../../store/auth'
import { Ionicons } from '@expo/vector-icons'
import { ThemeProvider, useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import ErrorBoundary from '../../components/ErrorBoundary'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

async function registerPushToken(userId: string) {
  if (!Device.isDevice) return // simulateur
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  const tokenData = await Notifications.getExpoPushTokenAsync()
  const token = tokenData.data
  const platform = Platform.OS === 'ios' ? 'ios' : 'android'

  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform }, { onConflict: 'user_id,token' })
}

function AppTabs() {
  const { isDark } = useTheme()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user?.id) {
      registerPushToken(user.id).catch(() => {})
    }
  }, [user?.id])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1D4ED8',
        tabBarInactiveTintColor: isDark ? '#6B7280' : '#9CA3AF',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: isDark ? '#374151' : '#F3F4F6',
          backgroundColor: isDark ? '#111827' : '#FFFFFF',
          paddingBottom: 8,
          height: 60,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Réserver',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Écrans sans tab (stack dans le layout) */}
      <Tabs.Screen name="account" options={{ href: null }} />
      <Tabs.Screen name="estimate" options={{ href: null }} />
      <Tabs.Screen name="confirm" options={{ href: null }} />
      <Tabs.Screen name="booking/[id]" options={{ href: null }} />
    </Tabs>
  )
}

export default function AppLayout() {
  const { isLoading } = useAuthStore()

  if (isLoading) return null

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppTabs />
      </ThemeProvider>
    </ErrorBoundary>
  )
}
