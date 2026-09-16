'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyAuthError } from '@/lib/auth-errors'
import { BackButton } from '@/components/ui'

export default function RegisterPage() {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [confirm,setConfirm] = useState('')
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (password.length < 12) return setError('Use at least 12 characters.')
    if (password !== confirm) return setError('Passwords don\'t match.')
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return setError('Supabase is not configured. Add the required environment variables and restart the app.')
    setLoading(true)
    const supabase = createClient()
    const origin = window.location.origin
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: `${origin}/auth/callback?next=/verify-email` }
    })
    if (error) {
      setError(friendlyAuthError(error.message, 'We could not create your account. Please try again.'))
      setLoading(false)
      return
    }
    // Always enter the verification screen first. Never infer verification from
    // the presence of a session because Supabase can return a session when
    // Confirm email is disabled/misconfigured. Production requires Confirm email.
    window.location.href = `/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`
  }

  return <main className="grid min-h-screen place-items-center bg-surface px-5 py-10">
    <div className="w-full max-w-md"><div className="flex items-center justify-between"><BackButton /><Link href="/" className="text-lg font-black text-slate-900">Skill<span className="text-brand">Forge</span></Link></div>
      <div className="card mt-8 p-7"><h1 className="text-2xl font-black text-slate-900">Create your account</h1><p className="mt-2 text-sm text-slate-400">Start learning and practicing job-ready skills.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email" value={email} setValue={setEmail} type="email" />
          <Field label="Password" value={password} setValue={setPassword} type="password" minLength={12} />
          <Field label="Confirm password" value={confirm} setValue={setConfirm} type="password" minLength={12} />
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
        </form>
        <div className="mt-5 text-center text-sm text-slate-500">Already have an account? <Link className="text-brand" href="/login">Sign in</Link></div>
      </div>
    </div>
  </main>
}

function Field({ label, value, setValue, type='text', minLength }: { label:string; value:string; setValue:(v:string)=>void; type?:string; minLength?:number }) { return <label className="block"><span className="label">{label}</span><input className="input" type={type} value={value} onChange={e=>setValue(e.target.value)} minLength={minLength} required /></label> }
