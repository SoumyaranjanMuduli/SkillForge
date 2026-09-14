import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { getPrograms } from '@/lib/assessment'
import { programVisual } from '@/lib/ui-helpers'
import type { Program } from '@/lib/types'

export default async function ProgramsPage() {
  const programs = await getPrograms()
  return <AppShell>
    <PageTitle eyebrow="Programs" title="Practice tracks" desc="Every program shares the same assessment engine, grading pipeline and review workflow." />
    <div className="stagger grid gap-4 md:grid-cols-2">
      {programs.map((p: Program) => {
        const { Icon, bg, text } = programVisual(p.name)
        return <div key={p.id} className="card card-hover p-6">
          <div className={`grid h-11 w-11 place-items-center rounded-xl ${bg} ${text}`}><Icon size={22} /></div>
          <div className="mt-4 text-xs font-semibold uppercase tracking-[.16em] text-brand">{p.slug}</div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{p.name}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{p.description}</p>
          <Link href={`/practice?program=${p.id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">Practice this track <ArrowRight size={14} /></Link>
        </div>
      })}
    </div>
  </AppShell>
}
