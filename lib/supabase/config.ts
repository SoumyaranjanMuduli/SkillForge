const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

export function getSupabasePublicConfig() {
  if (!url || !anonKey) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return null
  } catch {
    return null
  }
  return { url, anonKey }
}

export function requireSupabasePublicConfig() {
  const cfg = getSupabasePublicConfig()
  if (!cfg) {
    throw new Error('Supabase client is not configured')
  }
  return cfg
}
