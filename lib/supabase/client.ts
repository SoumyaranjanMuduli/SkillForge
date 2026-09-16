import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { getSupabasePublicConfig } from './config'

export function createClient() {
  const cfg = getSupabasePublicConfig()
  if (!cfg) throw new Error('Supabase client is not configured')
  const { url, anonKey } = cfg
  return createBrowserClient<Database>(url, anonKey)
}
