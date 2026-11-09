import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const subscriptionRef = useRef(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    const mountedRef = { current: true }
    getSupabaseClient().then(async (supabase) => {
      if (!mountedRef.current) return
      const { data, error } = await supabase.auth.getSession()
      if (error) console.error('Could not restore sign-in session:', error.message)
      if (mountedRef.current) {
        setSession(data?.session ?? null)
        setLoading(false)
      }
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession)
        setLoading(false)
      })
      subscriptionRef.current = authSubscription
      if (!mountedRef.current) authSubscription.unsubscribe()
    }).catch((error) => {
      if (!mountedRef.current) return
      console.error('Could not initialize Supabase sign-in:', error.message)
      setLoading(false)
    })

    return () => {
      mountedRef.current = false
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
  }, [])

  const value = useMemo(() => ({
    session,
    loading,
    configured: isSupabaseConfigured,
    signIn: async (email, password) => {
      if (!isSupabaseConfigured) throw new Error('Supabase sign-in is not configured.')
      const supabase = await getSupabaseClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setSession(data.session)
    },
    signOut: async () => {
      if (!isSupabaseConfigured) return
      const supabase = await getSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setSession(null)
    },
  }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
