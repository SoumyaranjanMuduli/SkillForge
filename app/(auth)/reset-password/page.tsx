'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage(){
  const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [error,setError]=useState(''); const [done,setDone]=useState(false); const [loading,setLoading]=useState(false)
  async function submit(e:React.FormEvent){e.preventDefault();setError('');if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return setError('Authentication is not configured yet.');if(password.length<12)return setError('Use at least 12 characters.');if(password!==confirm)return setError("Passwords don't match.");setLoading(true);const {error}=await createClient().auth.updateUser({password});if(error)setError(error.message);else{await createClient().auth.signOut();setDone(true)}setLoading(false)}
  return <main className="grid min-h-screen place-items-center bg-surface px-5 py-10"><div className="w-full max-w-md"><Link href="/" className="text-lg font-black text-slate-900">Skill<span className="text-brand">Forge</span></Link><div className="card mt-8 p-7"><h1 className="text-2xl font-black text-slate-900">Reset your password</h1><p className="mt-2 text-sm text-slate-400">Create a new secure password for your account.</p>{done?<div className="mt-6 space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">Password updated. You can sign in with your new password.</div><Link href="/login" className="btn-primary w-full">Go to login</Link></div>:<form onSubmit={submit} className="mt-6 space-y-4"><Field label="New password" value={password} setValue={setPassword}/><Field label="Confirm password" value={confirm} setValue={setConfirm}/>{error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>}<button className="btn-primary w-full" disabled={loading}>{loading?'Updating…':'Reset password'}</button></form>}</div></div></main>
}
function Field({label,value,setValue}:{label:string;value:string;setValue:(v:string)=>void}){return <label className="block"><span className="label">{label}</span><input className="input" type="password" minLength={12} value={value} onChange={e=>setValue(e.target.value)} required /></label>}
