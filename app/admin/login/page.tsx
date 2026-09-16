import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { AdminLoginForm } from '@/components/auth/AdminLoginForm'

export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  return <AdminLoginForm configured={Boolean(getSupabasePublicConfig())} />
}
