'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function VerifyEmailPage(){
  const params=useSearchParams(); const email=params.get('email')??''; const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false)
  useEffect(()=>{
    if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return
    void createClient().auth.getUser().then(async ({data})=>{if(!data.user?.email_confirmed_at)return;const {data:p}=await createClient().from('profiles').select('role,status').eq('id',data.user.id).maybeSingle();if(p?.status==='disabled')return;if(p?.role==='admin')window.location.href='/admin/dashboard';else if(data.user.email?.toLowerCase()==='soumyaranjanliku16@gmail.com')window.location.href='/admin/create-password';else window.location.href='/dashboard'})},[])
  async function resend(){if(!email||busy)return;setBusy(true);setMsg('');const {error}=await createClient().auth.resend({type:'signup',email,options:{emailRedirectTo:`${window.location.origin}/auth/callback?next=/verify-email`}});setMsg(error?error.message:'A new verification email has been sent.');setBusy(false)}
  return <main className="grid min-h-screen place-items-center bg-surface px-5 py-10"><div className="w-full max-w-md"><Link href="/" className="text-lg font-black text-slate-900">Skill<span className="text-brand">Forge</span></Link><div className="card mt-8 p-7 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/10 text-2xl">✉</div><h1 className="mt-5 text-2xl font-black text-slate-900">Check your email</h1><p className="mt-2 text-sm leading-6 text-slate-500">We sent a verification link{email?<> to <b>{email}</b></>:''}. Verify your account before signing in.</p><button onClick={()=>void resend()} disabled={!email||busy} className="btn-primary mt-6 w-full">{busy?'Sending…':'Resend verification email'}</button>{msg&&<div className="mt-4 text-sm text-slate-500">{msg}</div>}<Link href="/login" className="mt-5 inline-block text-sm font-semibold text-brand">Back to login</Link></div></div></main>
}
