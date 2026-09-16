'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyAuthError } from '@/lib/auth-errors'

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('')
    const normalized = email.trim().toLowerCase()
    if (!configured) { setError('Supabase is not configured. Add the required Vercel environment variables and redeploy.'); return }
    if (!normalized || !password) { setError('Enter your admin email and password.'); return }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: normalized, password })
      if (signInError || !data.user) throw new Error(signInError?.message || 'Sign-in failed.')
      if (!data.user.email_confirmed_at) { await supabase.auth.signOut(); window.location.assign(`/verify-email?email=${encodeURIComponent(normalized)}`); return }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('role,status').eq('id', data.user.id).maybeSingle()
      if (profile?.status === 'disabled') { await supabase.auth.signOut(); throw new Error('This account is not authorized for admin access.') }
      if (profileError || profile?.role !== 'admin') {
        const bootstrapResponse = await fetch('/api/admin/bootstrap', { method: 'POST' })
        if (!bootstrapResponse.ok) { await supabase.auth.signOut(); throw new Error('This account is not authorized for admin access.') }
      }
      window.location.assign('/admin/dashboard')
    } catch (err) {
      setError(err instanceof Error && err.message.includes('not authorized') ? err.message : friendlyAuthError(err instanceof Error ? err.message : 'Sign-in failed.', 'Sign-in failed.'))
    } finally { setBusy(false) }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-950 px-5 py-10"><div className="w-full max-w-md"><div className="rounded-3xl border border-white/10 bg-white p-7 shadow-2xl"><div className="badge-brand w-fit">Admin workspace</div><h1 className="mt-4 text-2xl font-black text-slate-900">Admin Login</h1><p className="mt-2 text-sm text-slate-500">Administrator access is verified securely on the server and database.</p>{!configured && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">Supabase is not configured for this deployment.</div>}<form onSubmit={login} className="mt-6 space-y-4"><label className="block"><span className="label">Admin email</span><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label><label className="block"><span className="label">Password</span><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>{error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>}<button className="btn-primary w-full" disabled={busy || !configured}>{busy ? 'Signing in…' : 'Sign in as admin'}</button></form><div className="mt-5 flex justify-between gap-4 text-sm"><Link href="/admin/create-password" className="text-brand">First-time admin setup</Link><Link href="/forgot-password" className="text-slate-500">Forgot password?</Link></div></div></div></main>
}
