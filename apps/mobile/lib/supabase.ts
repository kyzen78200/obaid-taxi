import { createClient, SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Ces variables doivent être renseignées dans apps/mobile/.env
// Voir SETUP.md pour les instructions
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Variables d\'environnement manquantes.\n' +
    'Créez le fichier apps/mobile/.env avec :\n' +
    'EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...'
  )
}

// Utilise des valeurs placeholder si non configuré — l'app démarre
// mais les appels réseau échoueront jusqu'à configuration réelle
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
