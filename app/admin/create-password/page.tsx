'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyAuthError } from '@/lib/auth-errors'
import { BackButton } from '@/components/ui'

type SetupStatus = { authorized: boolean; ready?: boolean; confirmed?: boolean }

export default function AdminCreatePasswordPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        if (!active || !data.user?.email) return
        setEmail(data.user.email)
        if (data.user.email_confirmed_at) {
          const res = await fetch('/api/admin/setup', { cache: 'no-store' })
          const status = (await res.json()) as SetupStatus
          if (active && status.authorized && !status.ready) setSent(true)
          if (active && status.ready) window.location.href = '/admin/dashboard'
        }
      } catch {
        if (active) setError('Authentication is not configured correctly.')
      }
    }
    void load()
    return () => { active = false }
  }, [])

  async function requestVerification(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Admin setup could not be started.')

      const supabase = createClient()
      if (json.mode === 'recovery') {
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/admin/create-password`,
        })
        if (recoveryError) throw recoveryError
      }
      setSent(true)
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : 'Unknown authentication error', 'Admin setup could not be completed. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function createPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 12) return setError('Use at least 12 characters.')
    if (password !== confirm) return setError("Passwords don't match.")
    setBusy(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user?.email_confirmed_at) throw new Error('Verify the admin email before creating the password.')

      const { error: passwordError } = await supabase.auth.updateUser({ password })
      if (passwordError) throw passwordError

      const response = await fetch('/api/admin/bootstrap', { method: 'POST' })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not provision the admin account.')
      if (json.profile?.role !== 'admin' || json.profile?.status !== 'active') throw new Error('Admin profile verification failed.')
      window.location.href = '/admin/dashboard'
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : 'Unknown authentication error', 'Admin setup could not be completed. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-950 px-5 py-10">
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between"><BackButton className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white" /><Link href="/" className="text-lg font-black text-white">Skill<span className="text-violet-400">Forge</span></Link></div>
      <div className="mt-8 rounded-3xl border border-white/10 bg-white p-7 shadow-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/10 text-2xl">♛</div>
        <h1 className="mt-5 text-center text-2xl font-black text-slate-900">Set your admin password</h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500">Use the authorized administrator email, verify it, then choose a secure password.</p>
        {!sent ? <form onSubmit={requestVerification} className="mt-6 space-y-4">
          <label className="block"><span className="label">Admin email</span><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send setup email'}</button>
        </form> : <form onSubmit={createPassword} className="mt-6 space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">A secure setup link was sent. Open it, return here, and create your password.</div>
          <label className="block"><span className="label">New admin password</span><input className="input" type="password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></label>
          <label className="block"><span className="label">Confirm password</span><input className="input" type="password" minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></label>
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create admin account'}</button>
        </form>}
        <div className="mt-5 text-center text-sm"><Link href="/admin/login" className="text-brand">Back to admin login</Link></div>
      </div>
    </div>
  </main>
}
