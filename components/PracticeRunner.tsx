'use client'

import { useState } from 'react'
import { CheckCircle2, PartyPopper } from 'lucide-react'
import type { Question } from '@/lib/types'
import { QuestionAnswer } from '@/components/QuestionAnswer'

export function PracticeRunner({ question }: { question: Question }) {
  const [value, setValue] = useState(question.starterCode ?? '')
  const [solved, setSolved] = useState(false)

  return <div className="card p-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-[.15em] text-slate-400">Practice mode — run freely, nothing is graded</span>
      {solved
        ? <span className="flex animate-pop-in items-center gap-1.5 text-sm font-bold text-emerald-600"><PartyPopper size={16} /> Nice work!</span>
        : <button onClick={() => setSolved(true)} className="btn-secondary !py-1.5 !px-3 text-xs"><CheckCircle2 size={14} /> Mark as solved</button>}
    </div>
    <QuestionAnswer q={question} value={value} onChange={setValue} />
  </div>
}
