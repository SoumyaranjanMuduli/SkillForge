'use client'

import { useState } from 'react'
import { CheckCircle2, MessageSquare, XCircle } from 'lucide-react'

type AttemptAnswerView = {
  question_id: string
  answer?: string
  is_correct?: boolean | null
  score?: number
  time_spent_sec: number
  admin_comment?: string | null
  feedback?: string | null
}

const TABS = ['Question Summary', 'Detailed View', 'Feedback'] as const

export function ResultsTabs({ answers, pct }: { answers: AttemptAnswerView[]; pct: number }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Question Summary')
  const overall = pct >= 80
    ? 'Great job! You have a solid understanding of the concepts covered. Keep pushing into harder problems.'
    : pct >= 50
      ? 'Solid attempt. Review the questions marked incorrect below and revisit those topics.'
      : 'This one was tough — that\'s normal while a topic is still new. Revisit the fundamentals and try a fresh assessment.'

  return <div className="card mt-6 p-6 animate-fade-in-up">
    <div className="flex flex-wrap gap-2 border-b border-line pb-3">
      {TABS.map((t) => (
        <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${tab === t ? 'bg-brand/10 text-brand' : 'text-slate-400 hover:text-slate-700'}`}>{t}</button>
      ))}
    </div>

    {tab === 'Question Summary' && <div className="mt-5">
      <div className="stagger grid grid-cols-5 gap-2.5 sm:grid-cols-8">
        {answers.map((a, i) => {
          const cls = a.is_correct === true ? 'bg-emerald-500 text-white' : a.is_correct === false ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'
          return <div key={a.question_id} title={`Question ${i + 1}`} className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-bold ${cls}`}>{i + 1}</div>
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
        <Legend swatch="bg-emerald-500" label="Correct" />
        <Legend swatch="bg-rose-500" label="Incorrect" />
        <Legend swatch="bg-slate-200" label="Not Attempted" />
      </div>
    </div>}

    {tab === 'Detailed View' && <div className="mt-5 space-y-4">
      {answers.map((a, i) => <div key={a.question_id} className="rounded-2xl border border-line p-5">
        <div className="flex items-center justify-between gap-4">
          <div><span className="badge">Q{i + 1}</span></div>
          <span className={`flex items-center gap-1 text-sm font-semibold ${a.is_correct === true ? 'text-emerald-600' : a.is_correct === false ? 'text-rose-500' : 'text-slate-400'}`}>
            {a.is_correct === true ? <CheckCircle2 size={15} /> : a.is_correct === false ? <XCircle size={15} /> : null}
            {a.is_correct === true ? 'Correct' : a.is_correct === false ? 'Incorrect' : 'Manual review'}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div><div className="label">Your answer</div><pre className="overflow-auto rounded-xl border border-line bg-slate-50 p-4 text-xs text-slate-600">{a.answer || '(blank)'}</pre></div>
          <div><div className="label">Feedback</div><div className="rounded-xl border border-line bg-slate-50 p-4 text-sm text-slate-600">{a.feedback ?? 'No feedback.'}</div></div>
        </div>
        {a.admin_comment && <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-slate-700">Admin: {a.admin_comment}</div>}
      </div>)}
    </div>}

    {tab === 'Feedback' && <div className="mt-5 rounded-2xl border border-line bg-slate-50 p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><MessageSquare size={16} className="text-brand" /> Overall Feedback</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{overall}</p>
    </div>}
  </div>
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return <div className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${swatch}`} /> {label}</div>
}
