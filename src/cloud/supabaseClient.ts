import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../data/supabase.types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const cloudConfigured = Boolean(url && publishableKey)

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (!url || !publishableKey) throw new Error('Supabase n’est pas configuré pour cet environnement')
  client ??= createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
