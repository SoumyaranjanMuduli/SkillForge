'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import type { Question } from '@/lib/types'
import { difficultyBadgeClass } from '@/lib/ui-helpers'

export function PracticeQueue({ questions, programId }: { questions: Question[]; programId: string }) {
  const related = questions.filter(q => q.programId === programId).slice(0, 24)
  if (!related.length) return null

  return <section className="mt-10">
    <div className="mb-4 flex items-end justify-between gap-3"><div><div className="badge-brand"><CheckCircle2 size={13} /> More practice</div><h2 className="mt-2 text-xl font-black text-slate-900">Keep going</h2><p className="mt-1 text-sm text-slate-500">More challenges from the same subject, with all three difficulty levels.</p></div><Link href={`/practice?program=${programId}`} className="text-xs font-bold text-brand">View full bank <ArrowRight size={13} className="inline" /></Link></div>
    <div className="grid gap-3 md:grid-cols-2">
      {related.map(q => <Link href={`/practice/${q.id}`} key={q.id} className="card card-hover p-4"><div className="flex items-center gap-2"><span className={difficultyBadgeClass(q.difficulty)}>{q.difficulty}</span><span className="badge">{q.topic}</span></div><div className="mt-2 text-sm font-bold text-slate-900">{q.title}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{q.prompt}</div></Link>)}
    </div>
  </section>
}
