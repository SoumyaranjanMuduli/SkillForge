'use client'
import { useState } from 'react'
import type { AdminAttempt, AdminAttemptAnswer } from '@/lib/admin-attempt'

export function AdminReview({ attempt }: { attempt: AdminAttempt }) {
  const [rows, setRows] = useState<AdminAttemptAnswer[]>(attempt.attempt_answers ?? [])
  const [msg, setMsg] = useState('')
  async function save(a: AdminAttemptAnswer) {
    setMsg('Saving…')
    const res = await fetch(`/api/admin/results/${attempt.id}/review`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ answerId:a.id, score:Number(a.score), isCorrect:a.is_correct, adminComment:a.admin_comment ?? '' }) })
    setMsg(res.ok ? 'Review saved.' : 'Could not save review.')
  }
  async function release() {
    setMsg('Releasing…')
    const res = await fetch(`/api/admin/results/${attempt.id}/release`, { method:'POST' })
    setMsg(res.ok ? 'Result released.' : 'Could not release result.')
  }
  return <main className="min-h-screen bg-surface p-5 md:p-8"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs uppercase tracking-[.18em] text-brand">Admin review</div><h1 className="mt-2 text-3xl font-black text-slate-900">{attempt.profiles?.full_name || 'User'} · {attempt.assessments?.name}</h1><p className="mt-2 text-sm text-slate-400">Score {attempt.score}/{attempt.max_score} · {attempt.status}</p></div><div className="flex gap-2"><span className="self-center text-sm text-slate-400">{msg}</span><button className="btn-primary" onClick={()=>void release()} disabled={attempt.status==='released'}>Grant result access</button></div></div><div className="mt-8 space-y-4">{rows.map((a,i:number)=><div key={a.id} className="card p-5"><div className="flex items-center justify-between"><span className="badge">Q{i+1}</span><span className="text-xs text-slate-500">{a.time_spent_sec}s</span></div><pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-slate-900 p-4 font-mono text-xs text-slate-300">{a.answer || '(blank)'}</pre><div className="mt-4 grid gap-3 md:grid-cols-3"><label><span className="label">Correct?</span><select className="input" value={a.is_correct == null ? 'pending' : String(a.is_correct)} onChange={e=>setRows((x)=>x.map(r=>r.id===a.id?{...r,is_correct:e.target.value==='pending'?null:e.target.value==='true'}:r))}><option value="pending">Pending</option><option value="true">Correct</option><option value="false">Wrong</option></select></label><label><span className="label">Marks</span><input className="input" type="number" min="0" value={a.score} onChange={e=>setRows((x)=>x.map(r=>r.id===a.id?{...r,score:Number(e.target.value)}:r))}/></label><label><span className="label">Admin comment</span><input className="input" value={a.admin_comment ?? ''} onChange={e=>setRows((x)=>x.map(r=>r.id===a.id?{...r,admin_comment:e.target.value}:r))}/></label></div><button className="btn-secondary mt-4" onClick={()=>void save(a)}>Save review</button></div>)}</div></div></main>
}
