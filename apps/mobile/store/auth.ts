import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '@obaid-taxi/shared'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isGuest: boolean
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

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
      // Réinitialise le mode invité dès qu'une vraie session est établie
      isGuest: session ? false : undefined,
    }),

  setProfile: (profile) => set({ profile }),

  setGuest: () =>
    set({ isGuest: true, session: null, user: null, isLoading: false }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null, isGuest: false })
  },
}))
