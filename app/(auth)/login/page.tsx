import Link from 'next/link'
import { BackButton } from '@/components/ui'
import { LoginForm } from '@/components/auth/LoginForm'
import { getSupabasePublicConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; detail?: string }> }) {
  const configured = Boolean(getSupabasePublicConfig())
  const { error, detail } = await searchParams
  const initialError = error && detail ? `${error}::${detail}` : error
  return (
    <main className="auth-page min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between"><BackButton /><Link href="/" className="text-lg font-black text-slate-900">Skill<span className="text-brand">Forge</span></Link></div>
        <LoginForm configured={configured} initialError={initialError} />
      </div>
    </main>
  )
}
