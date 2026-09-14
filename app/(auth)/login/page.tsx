'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return setError('Authentication is not configured yet.')
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) { setError(error.message); setLoading(false); return }
    if (!data.user.email_confirmed_at) { window.location.href = `/verify-email?email=${encodeURIComponent(data.user.email ?? email)}`; return }
    const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', data.user.id).maybeSingle()
    if (profile?.status === 'disabled') { await supabase.auth.signOut(); setError('This account has been disabled.'); setLoading(false); return }
    window.location.href = profile?.role === 'admin' ? '/admin/dashboard' : '/dashboard'
  }

  return <main className="grid min-h-screen place-items-center bg-surface px-5 py-10">
    <div className="w-full max-w-md"><Link href="/" className="text-lg font-black text-slate-900">Skill<span className="text-brand">Forge</span></Link>
      <div className="card mt-8 p-7">
        <h1 className="text-2xl font-black text-slate-900">Welcome back</h1><p className="mt-2 text-sm text-slate-400">Sign in to continue your learning.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email" value={email} setValue={setEmail} type="email" />
          <Field label="Password" value={password} setValue={setPassword} type="password" />
          <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-semibold text-brand">Forgot password?</Link></div>
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="mt-5 text-center text-sm text-slate-500">New here? <Link className="text-brand" href="/register">Create an account</Link></div>
        <div className="mt-4 text-center"><Link href="/admin/login" className="text-xs font-semibold text-slate-400 hover:text-brand">Admin access</Link></div>
      </div>
    </div>
  </main>
}

function Field({ label, value, setValue, type }: { label:string; value:string; setValue:(v:string)=>void; type:string }) { return <label className="block"><span className="label">{label}</span><input className="input" type={type} value={value} onChange={e=>setValue(e.target.value)} required /></label> }
