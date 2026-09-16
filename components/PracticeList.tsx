'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, BarChart3, BookOpen, Code2, Database, FileSpreadsheet, Search, Sigma, Sparkles } from 'lucide-react'
import type { Difficulty, Program, Question } from '@/lib/types'
import { PRACTICE_PROGRAMS } from '@/lib/practice-catalog'
import { difficultyBadgeClass } from '@/lib/ui-helpers'

const DIFFICULTIES: (Difficulty | 'all')[] = ['all', 'easy', 'medium', 'hard']
const ICONS = { sql: Database, python: Code2, excel: FileSpreadsheet, numpy: Sigma, pandas: BarChart3 } as const

export function PracticeList({ questions, programs: _programs, successRates }: { questions: Question[]; programs: Program[]; successRates: Record<string, number | null> }) {
  const params = useSearchParams()
  const [program, setProgram] = useState<string>(params.get('program') ?? 'all')
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 40

  const filtered = useMemo(() => questions.filter(q => {
    if (program !== 'all' && q.programId !== program) return false
    if (difficulty !== 'all' && q.difficulty !== difficulty) return false
    if (search) {
      const haystack = `${q.title} ${q.topic} ${q.prompt}`.toLowerCase()
      if (!haystack.includes(search.toLowerCase())) return false
    }
    return true
  }), [questions, program, difficulty, search])

  useEffect(() => { setPage(1) }, [program, difficulty, search])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleQuestions = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return <div>
    <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {PRACTICE_PROGRAMS.map(item => {
        const Icon = ICONS[item.icon as keyof typeof ICONS]
        const active = program === item.id
        const count = questions.filter(q => q.programId === item.id).length
        return <button key={item.id} type="button" onClick={() => setProgram(active ? 'all' : item.id)} className={`group rounded-2xl border p-4 text-left transition-all ${active ? 'border-brand bg-brand/10 shadow-pop' : 'border-line bg-white hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card'}`}>
          <div className="flex items-center justify-between"><span className={`grid h-11 w-11 place-items-center rounded-xl ${active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-brand/10 group-hover:text-brand'}`}><Icon size={21} /></span><ArrowRight size={16} className={active ? 'text-brand' : 'text-slate-300'} /></div>
          <div className="mt-4 text-sm font-black text-slate-900">{item.name}</div>
          <div className="mt-1 text-xs text-slate-400">{count} practice questions</div>
        </button>
      })}
    </div>

    <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
      <div className="relative min-w-[200px] flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search practice questions…" className="input !pl-9" /></div>
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-slate-50 p-1">{DIFFICULTIES.map(d => <button key={d} type="button" onClick={() => setDifficulty(d)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${difficulty === d ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{d}</button>)}</div>
      <span className="hidden items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-2 text-xs font-semibold text-brand sm:flex"><BookOpen size={13} /> {filtered.length} questions</span>
    </div>

    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="badge-brand"><Sparkles size={13} /> Practice Lab</div><h2 className="mt-2 text-2xl font-black text-slate-900">Pick a challenge</h2><p className="mt-1 text-sm text-slate-500">Practice questions across Easy, Medium and Hard, sourced from the course material.</p></div><div className="text-xs font-semibold text-slate-400">{filtered.length} shown</div></div>

    <div className="stagger grid gap-3 lg:grid-cols-2">
      {visibleQuestions.map(q => <PracticeCard key={q.id} q={q} rate={successRates[q.id]} />)}
      {!filtered.length && <div className="card col-span-full p-10 text-center text-sm text-slate-400">No practice questions match those filters.</div>}
    </div>
    {filtered.length > PAGE_SIZE && <div className="mt-5 flex items-center justify-between gap-3">
      <button type="button" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
      <span className="text-xs font-semibold text-slate-400">Page {safePage} of {pageCount} · {filtered.length} total</span>
      <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40">Next</button>
    </div>}
  </div>
}

function PracticeCard({ q, rate }: { q: Question; rate: number | null | undefined }) {
  return <div className="card card-hover flex flex-wrap items-center justify-between gap-4 p-5">
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={difficultyBadgeClass(q.difficulty)}>{q.difficulty}</span><span className="badge">{q.topic}</span></div><div className="mt-2 font-bold text-slate-900">{q.title}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{q.prompt}</div><div className="mt-2 text-xs text-slate-400">{rate == null ? 'New challenge' : `${rate}% community success`} · {q.marks} marks</div></div>
    <Link href={`/practice/${q.id}`} className="btn-secondary shrink-0 !border-brand/30 !text-brand">Solve <ArrowRight size={15} /></Link>
  </div>
}
