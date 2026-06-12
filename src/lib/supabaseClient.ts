/**
 * Supabase client for user accounts and server-synced subscriptions.
 *
 * Accounts are optional infrastructure: when the environment variables are
 * not set (e.g. a fork without a Supabase project), `supabase` is null and
 * the site falls back to anonymous, in-browser subscriptions exactly as
 * before. Configure in Netlify / .env:
 *
 *   VITE_SUPABASE_URL=https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon public key>
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

/** True when the site is configured with a Supabase project. */
export const accountsEnabled = supabase !== null
