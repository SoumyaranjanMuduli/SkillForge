'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyAuthError } from '@/lib/auth-errors'

export function LoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!configured) {
      setError('Supabase is not configured. Add the required Vercel environment variables and redeploy.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError || !data.user) {
        setError(friendlyAuthError(signInError?.message ?? 'Sign-in failed.', 'We could not sign you in. Please check your credentials and try again.'))
        return
      }
      if (!data.user.email_confirmed_at) {
        window.location.assign(`/verify-email?email=${encodeURIComponent(data.user.email ?? email)}`)
        return
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role,status,onboarding_complete')
        .eq('id', data.user.id)
        .maybeSingle()
      if (profileError) throw profileError
      if (profile?.status === 'disabled') {
        await supabase.auth.signOut()
        setError('This account has been disabled.')
        return
      }
      window.location.assign(profile?.role === 'admin' ? '/admin/dashboard' : profile?.onboarding_complete ? '/dashboard' : '/account/setup')
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : 'Sign-in failed.', 'We could not sign you in. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-login-grid overflow-hidden rounded-[2rem] border border-white/80 bg-white/75 shadow-[0_30px_90px_rgba(37,50,85,.13)] backdrop-blur-xl">
      <section className="auth-login-visual hidden p-10 lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Sparkles size={17} fill="currentColor" /></span> SkillForge</div>
          <div className="mt-20 max-w-md"><p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">Your next skill, made visible</p><h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-[-.04em] text-white">Build confidence one challenge at a time.</h1><p className="mt-6 text-sm leading-7 text-blue-100/80">Practice real-world skills, understand your progress, and turn focused learning into momentum.</p></div>
        </div>
        <div className="grid gap-3 text-sm text-blue-50"><div className="flex items-center gap-3"><CheckCircle2 size={17} className="text-cyan-300" /> Guided practice across modern skills</div><div className="flex items-center gap-3"><CheckCircle2 size={17} className="text-cyan-300" /> Clear feedback after every attempt</div></div>
      </section>
      <section className="p-6 sm:p-10 lg:p-14">
        <div className="mx-auto max-w-md">
          <div className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-brand"><ShieldCheck size={16} /> Secure learner access</div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Welcome back</h1><p className="mt-3 text-sm leading-6 text-slate-500">Sign in to continue your learning.</p>
          {!configured && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">Authentication is not configured for this deployment yet. Add the Supabase environment variables in Vercel and redeploy.</div>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email" value={email} setValue={setEmail} type="email" autoComplete="username" />
            <Field label="Password" value={password} setValue={setPassword} type="password" autoComplete="current-password" />
            <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-semibold text-brand">Forgot password?</Link></div>
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
            <button className="btn-primary w-full" disabled={loading || !configured}>{loading ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</button>
          </form>
          <div className="mt-5 text-center text-sm text-slate-500">New here? <Link className="font-semibold text-brand" href="/register">Create an account</Link></div>
          <div className="mt-5 border-t border-slate-100 pt-5"><Link href="/admin/login" className="btn-secondary flex w-full justify-center">Admin login</Link></div>
        </div>
      </section>
    </div>
  )
}

function Field({ label, value, setValue, type, autoComplete }: { label: string; value: string; setValue: (v: string) => void; type: string; autoComplete: string }) {
  return <label className="block"><span className="label">{label}</span><input className="input" type={type} value={value} onChange={e => setValue(e.target.value)} autoComplete={autoComplete} required /></label>
}
