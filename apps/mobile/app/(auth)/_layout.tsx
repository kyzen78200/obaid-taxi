import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '../../store/auth'

export default function AuthLayout() {
  const { session, isGuest, isLoading } = useAuthStore()

  if (isLoading) return null

  // Si déjà connecté → rediriger vers l'app (pas si invité, pour lui permettre de se connecter)
  if (session) {
    return <Redirect href="/(app)" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
