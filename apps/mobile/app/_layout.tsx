import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'

SplashScreen.preventAutoHideAsync()

// ── Error Boundary global ─────────────────────────────────────────────────────
// Attrape les erreurs de rendu non gérées et affiche un écran de fallback
// plutôt qu'un crash silencieux.
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#1f2937' }}>
            Une erreur est survenue
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
            {this.state.error?.message ?? 'Erreur inconnue. Relancez l\'application.'}
          </Text>
        </View>
      )
    }
    return this.props.children
  }
}

// ── Root Layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  const { setSession, setProfile } = useAuthStore()

  useEffect(() => {
    // Écouter les changements de session Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          setProfile(profile)
        } else {
          setProfile(null)
        }

        SplashScreen.hideAsync()
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AppErrorBoundary>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </AppErrorBoundary>
  )
}
