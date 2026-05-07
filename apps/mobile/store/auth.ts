import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '@obaid-taxi/shared'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** true si l'utilisateur navigue sans compte (mode invité) */
  isGuest: boolean
  /** true pendant l'initialisation de la session au démarrage de l'app */
  isLoading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setGuest: () => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isGuest: false,
  isLoading: true,

  /**
   * Appelé par onAuthStateChange dans _layout.tsx à chaque changement de session Supabase.
   * Note : isGuest est mis à `undefined` (falsy) si session est null — comportement voulu
   * pour ne pas forcer le mode invité lors d'une déconnexion normale.
   */
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
      // Réinitialise le mode invité dès qu'une vraie session est établie
      isGuest: session ? false : undefined,
    }),

  /** Met à jour le profil après chargement depuis Supabase (table profiles) */
  setProfile: (profile) => set({ profile }),

  /** Active le mode invité — l'utilisateur peut réserver sans compte */
  setGuest: () =>
    set({ isGuest: true, session: null, user: null, isLoading: false }),

  /** Déconnecte l'utilisateur de Supabase et réinitialise tout l'état auth */
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null, isGuest: false })
  },
}))
