import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// Supabase renamed the anon key to the publishable key; legacy projects still
// issue the old one, and both go in the same slot.
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Sync is optional. With no `.env` the app is exactly what it was before —
 * local-only, no account, nothing to fail — and the Settings screen says so
 * instead of offering a sign-in that could never work.
 */
export const syncConfigured = Boolean(url && publishableKey)

export const supabase: SupabaseClient | null = syncConfigured
  ? createClient(url!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

/** One row of the `records` table — see `supabase/schema.sql`. */
export interface RemoteRecord {
  kind: string
  id: string
  data: Record<string, unknown> | null
  deleted: boolean
  updated_at: number
  synced_at: string
}
