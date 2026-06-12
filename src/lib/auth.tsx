/**
 * Auth context: passwordless (magic-link) sign-in via Supabase.
 *
 * When accounts are not configured (supabase === null) the provider renders
 * with user = null and signIn reports the feature as unavailable, so every
 * consumer can treat "signed out" and "accounts disabled" the same way.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

interface AuthValue {
  user: User | null
  /** True while the initial session is being restored. */
  loading: boolean
  /** Send a magic sign-in link. Resolves to an error message or null. */
  signIn: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: false,
  signIn: async () => 'Accounts are not configured on this deployment.',
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string): Promise<string | null> => {
    if (!supabase) return 'Accounts are not configured on this deployment.'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    })
    return error ? error.message : null
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  return useContext(AuthContext)
}
