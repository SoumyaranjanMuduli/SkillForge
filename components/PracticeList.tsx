'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { Difficulty, Program, Question } from '@/lib/types'
import { difficultyBadgeClass, programVisual } from '@/lib/ui-helpers'

const DIFFICULTIES: (Difficulty | 'all')[] = ['all', 'easy', 'medium', 'hard']

export function PracticeList({ questions, programs, successRates }: { questions: Question[]; programs: Program[]; successRates: Record<string, number | null> }) {
  const params = useSearchParams()
  const [program, setProgram] = useState<string>(params.get('program') ?? 'all')
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => questions.filter((q) => {
    if (program !== 'all' && q.programId !== program) return false
    if (difficulty !== 'all' && q.difficulty !== difficulty) return false
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) && !q.topic.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [questions, program, difficulty, search])

  return <div>
    <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search challenges…" className="input !pl-9" />
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-slate-50 p-1">
        {DIFFICULTIES.map((d) => (
          <button key={d} onClick={() => setDifficulty(d)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${difficulty === d ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{d}</button>
        ))}
      </div>
      <select value={program} onChange={(e) => setProgram(e.target.value)} className="input w-auto !py-2">
        <option value="all">All programs</option>
        {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <span className="hidden items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-2 text-xs font-semibold text-brand sm:flex"><SlidersHorizontal size={13} /> {filtered.length} challenges</span>
    </div>

    <div className="stagger space-y-3">
      {filtered.map((q) => {
        const rate = successRates[q.id]
        const { Icon, bg, text } = programVisual(q.programId)
        return <div key={q.id} className="card card-hover flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${bg} ${text}`}><Icon size={18} /></div>
            <div>
              <div className="font-bold text-slate-900">{q.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className={difficultyBadgeClass(q.difficulty)}>{cap(q.difficulty)}</span>
                <span>{q.topic}</span>
                <span>· Max Score: {q.marks}</span>
                <span className="flex items-center gap-1">· Success Rate: {rate === null ? <span className="inline-flex items-center gap-1 font-semibold text-brand"><Sparkles size={11} /> New</span> : <span className={rate >= 70 ? 'font-semibold text-emerald-600' : rate >= 40 ? 'font-semibold text-amber-600' : 'font-semibold text-rose-500'}>{rate}%</span>}</span>
              </div>
            </div>
          </div>
          <Link href={`/practice/${q.id}`} className="btn-secondary shrink-0 !border-brand/30 !text-brand hover:!bg-brand/5">Solve Challenge <ArrowRight size={15} /></Link>
        </div>
      })}
      {filtered.length === 0 && <div className="card p-10 text-center text-sm text-slate-400">No challenges match those filters.</div>}
    </div>
  </div>
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
