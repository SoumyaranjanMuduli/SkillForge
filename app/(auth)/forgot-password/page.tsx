'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyAuthError } from '@/lib/auth-errors'
import { BackButton } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email,setEmail] = useState('')
  const [sent,setSent] = useState(false)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) { setError('Authentication is not configured yet.'); setLoading(false); return }
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` })
    if (error) setError(friendlyAuthError(error.message, 'We could not send the reset email. Please try again.')); else setSent(true)
    setLoading(false)
  }
  return <AuthCard title="Forgot password?" desc="Enter your email and we’ll send a password reset link.">
    {sent ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">If an account exists for this email, a reset link has been sent. Check your inbox.</div> : <form onSubmit={submit} className="space-y-4"><Field label="Email address" value={email} setValue={setEmail} type="email" />{error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>}<button className="btn-primary w-full" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button></form>}
    <div className="mt-5 text-center text-sm"><Link className="text-brand" href="/login">Back to login</Link></div>
  </AuthCard>
}
function AuthCard({title,desc,children}:{title:string;desc:string;children:React.ReactNode}){return <main className="grid min-h-screen place-items-center bg-surface px-5 py-10"><div className="w-full max-w-md"><div className="flex items-center justify-between"><BackButton /><Link href="/" className="text-lg font-black text-slate-900">Skill<span className="text-brand">Forge</span></Link></div><div className="card mt-8 p-7"><h1 className="text-2xl font-black text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-400">{desc}</p><div className="mt-6">{children}</div></div></div></main>}
function Field({label,value,setValue,type}:{label:string;value:string;setValue:(v:string)=>void;type:string}){return <label className="block"><span className="label">{label}</span><input className="input" type={type} value={value} onChange={e=>setValue(e.target.value)} required /></label>}
