import Link from 'next/link'
import { AppShell, PageTitle } from '@/components/AppShell'
import { getAssessmentsForUser, getPrograms, getServerUser } from '@/lib/assessment'
import { programVisual } from '@/lib/ui-helpers'
import type { Assessment, Program } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AssessmentsPage({ searchParams }: { searchParams?: Promise<{ program?: string }> }) {
  const user = await getServerUser()
  if (!user) return null
  const { program = '' } = await (searchParams ?? Promise.resolve({} as { program?: string }))
  const [assessments, programs] = await Promise.all([getAssessmentsForUser(user.id), getPrograms()])
  const visibleAssessments = program ? assessments.filter(a => a.programId === program) : assessments

  return <AppShell>
    <PageTitle eyebrow="Student" title="My Assessments" desc="Everything assigned or published to you, ready to start whenever you are." />
    {visibleAssessments.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">Nothing assigned yet. Check back soon.</div>}
    <div className="stagger grid gap-4 md:grid-cols-2">
      {visibleAssessments.map((a: Assessment) => {
        const p = (programs as Program[]).find((x) => x.id === a.programId)
        const { Icon, bg, text } = programVisual(p?.name ?? a.programId)
        return <div key={a.id} className="card card-hover p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`mb-3 inline-grid h-9 w-9 place-items-center rounded-lg ${bg} ${text}`}><Icon size={18} /></div>
              <div className="badge">{p?.name ?? a.programId}</div>
              <h2 className="mt-3 text-xl font-bold text-slate-900">{a.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{a.description}</p>
            </div>
            <div className="whitespace-nowrap text-right text-xs text-slate-400">{Math.round(a.durationSec / 60)} min<br />{a.questionIds.length} questions</div>
          </div>
          <Link className="btn-primary mt-6" href={`/assessment/${a.id}`}>Start assessment</Link>
        </div>
      })}
    </div>
  </AppShell>
}
