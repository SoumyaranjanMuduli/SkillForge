import Link from 'next/link'
import { ArrowRight, ClipboardCheck } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import CourseLibrary from '@/components/CourseLibrary'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPrograms } from '@/lib/assessment'
import { programVisual } from '@/lib/ui-helpers'
import type { Program } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function CoursesPage() {
  const programs = await getPrograms()
  const db = createAdminClient() as any
  const ids = programs.map(p => p.id)
  const { data: questions } = ids.length ? await db.from('questions').select('program_id,difficulty').in('program_id', ids).eq('status', 'published') : { data: [] }
  const counts = new Map<string, { total: number; easy: number; medium: number; hard: number }>()
  for (const q of questions ?? []) {
    const x = counts.get(q.program_id) ?? { total: 0, easy: 0, medium: 0, hard: 0 }
    x.total++
    x[q.difficulty as 'easy' | 'medium' | 'hard']++
    counts.set(q.program_id, x)
  }

  return <AppShell>
    <PageTitle eyebrow="Student" title="Courses" desc="Read your study material as clean web pages, then jump into practice and assessments." />
    <CourseLibrary />

    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><div className="badge-brand mb-2"><ClipboardCheck size={14} /> Practice</div><h2 className="text-2xl font-black text-slate-900">Practice & assessments</h2><p className="mt-1 text-sm text-slate-500">Use the existing question banks after studying the material.</p></div>
      </div>
      {programs.length === 0 ? <div className="card p-10 text-center text-sm text-slate-500">No practice courses have been published yet.</div> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {programs.map((p: Program) => {
            const { Icon, bg, text } = programVisual(p.name)
            const c = counts.get(p.id) ?? { total: 0, easy: 0, medium: 0, hard: 0 }
            return <Link href={`/courses/${p.id}`} key={p.id} className="card card-hover group p-5">
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${bg} ${text}`}><Icon size={21} /></div>
              <h3 className="mt-4 text-base font-black text-slate-900">{p.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{p.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-brand">{c.total} published questions <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></div>
            </Link>
          })}
        </div>
      }
    </section>
  </AppShell>
}
