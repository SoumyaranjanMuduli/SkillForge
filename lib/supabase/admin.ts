import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getSupabasePublicConfig } from './config'

let client: SupabaseClient<Database> | null = null

export function createAdminClient() {
  if (client) return client
  const cfg = getSupabasePublicConfig()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!cfg || !key) throw new Error('Supabase server credentials are not configured')
  client = createSupabaseClient<Database>(cfg.url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return client
}
