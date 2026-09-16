import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'
import { getSupabasePublicConfig } from './config'

export async function createClient() {
  const cfg = getSupabasePublicConfig()
  if (!cfg) throw new Error('Supabase client is not configured')
  const { url, anonKey } = cfg
  const cookieStore = await cookies()
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
      }
    }
  })
}
