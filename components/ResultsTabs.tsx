'use client'

import { useState } from 'react'
import { CheckCircle2, MessageSquare, XCircle } from 'lucide-react'

type AttemptAnswerView = {
  question_id: string
  title?: string
  prompt?: string
  answer?: string
  is_correct?: boolean | null
  score?: number
  marks?: number
  time_spent_sec: number
  admin_comment?: string | null
  feedback?: string | null
}

const TABS = ['Question Summary', 'Mistakes', 'Detailed View', 'Feedback'] as const

export function ResultsTabs({ answers, pct, rank }: { answers: AttemptAnswerView[]; pct: number; rank?: { position: number; total: number } | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Question Summary')
  const mistakes = answers.filter(a => a.is_correct === false)
  const overall = pct >= 80 ? 'Strong attempt. Use the question-level view to keep improving.' : pct >= 50 ? 'Good progress. Review the incorrect questions below and revisit those topics.' : 'Keep practicing the fundamentals, then take a fresh assessment to measure your progress.'

  return <div className="card mt-6 p-6 animate-fade-in-up">
    <div className="flex flex-wrap gap-2 border-b border-line pb-3">{TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${tab === t ? 'bg-brand/10 text-brand' : 'text-slate-400 hover:text-slate-700'}`}>{t}</button>)}</div>
    {rank && <div className="mt-5 rounded-2xl border border-brand/15 bg-brand/5 p-4 text-sm text-slate-600"><span className="font-bold text-brand">Assessment position:</span> {rank.position} of {rank.total} released attempts.</div>}

    {tab === 'Question Summary' && <div className="mt-5"><div className="stagger grid grid-cols-5 gap-2.5 sm:grid-cols-8">{answers.map((a,i)=>{const cls=a.is_correct===true?'bg-emerald-500 text-white':a.is_correct===false?'bg-rose-500 text-white':'bg-slate-100 text-slate-400';return <button onClick={()=>setTab('Detailed View')} key={a.question_id} title={a.title ? `Q${i+1}: ${a.title}` : `Question ${i+1}`} className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-bold ${cls}`}>{i+1}</button>})}</div><div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500"><Legend swatch="bg-emerald-500" label="Correct"/><Legend swatch="bg-rose-500" label="Incorrect"/><Legend swatch="bg-slate-200" label="Not Attempted"/></div></div>}
    {tab === 'Mistakes' && <div className="mt-5 space-y-4">{mistakes.length===0?<div className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-700">No incorrect answers in the released result.</div>:mistakes.map(a=><AnswerCard key={a.question_id} a={a} index={answers.indexOf(a)}/>)}</div>}
    {tab === 'Detailed View' && <div className="mt-5 space-y-4">{answers.map((a,i)=><AnswerCard key={a.question_id} a={a} index={i}/>)}</div>}
    {tab === 'Feedback' && <div className="mt-5 rounded-2xl border border-line bg-slate-50 p-5"><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><MessageSquare size={16} className="text-brand"/> Overall Feedback</div><p className="mt-2 text-sm leading-6 text-slate-600">{overall}</p></div>}
  </div>
}

function AnswerCard({a,index}:{a:AttemptAnswerView;index:number}){return <div className="rounded-2xl border border-line p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="badge">Q{index+1}</span><h3 className="mt-3 font-bold text-slate-900">{a.title ?? 'Question'}</h3></div><span className={`flex items-center gap-1 text-sm font-semibold ${a.is_correct===true?'text-emerald-600':a.is_correct===false?'text-rose-500':'text-slate-400'}`}>{a.is_correct===true?<CheckCircle2 size={15}/>:a.is_correct===false?<XCircle size={15}/>:null}{a.is_correct===true?'Correct':a.is_correct===false?'Incorrect':'Manual review'}</span></div>{a.prompt&&<p className="mt-3 text-sm leading-6 text-slate-500">{a.prompt}</p>}<div className="mt-4 grid gap-3 md:grid-cols-2"><div><div className="label">Your answer</div><pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-slate-50 p-4 text-xs text-slate-600">{a.answer||'(blank)'}</pre></div><div><div className="label">Feedback</div><div className="rounded-xl border border-line bg-slate-50 p-4 text-sm text-slate-600">{a.feedback??'No feedback.'}</div></div></div>{a.admin_comment&&<div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-slate-700">Admin: {a.admin_comment}</div>}<div className="mt-3 text-xs text-slate-400">Score: {a.score ?? 0}/{a.marks ?? '—'} · Time: {a.time_spent_sec}s</div></div>}
function Legend({swatch,label}:{swatch:string;label:string}){return <div className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${swatch}`}/>{label}</div>}
