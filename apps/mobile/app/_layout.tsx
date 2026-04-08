import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'

SplashScreen.preventAutoHideAsync()

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
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </>
  )
}
