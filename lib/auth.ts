import { createClient } from './supabase/server'
import { getSupabasePublicConfig } from './supabase/config'

export async function getUser() {
  if (!getSupabasePublicConfig()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getProfile() {
  if (!getSupabasePublicConfig()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return data
}

export async function requireAdmin() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin' || (profile as any).status === 'disabled') throw new Error('Admin access required')
  return profile
}
