export const isSupabaseConfigured = Boolean(__SUPABASE_URL__ && __SUPABASE_PUBLIC_KEY__)

let clientPromise

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    return Promise.reject(new Error('Supabase sign-in is not configured.'))
  }
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(__SUPABASE_URL__, __SUPABASE_PUBLIC_KEY__),
  )
  return clientPromise
}
