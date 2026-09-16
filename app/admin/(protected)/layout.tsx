import { requireAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try { await requireAdmin() } catch { redirect('/admin/login?error=admin') }
  return <>{children}</>
}
