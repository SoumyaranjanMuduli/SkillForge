import Link from 'next/link'
import { CheckCircle2, Clock, Lock } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { getServerUser, getUserAttempts } from '@/lib/assessment'

export const dynamic = 'force-dynamic'

export default async function ResultsListPage() {
  const user = await getServerUser()
  if (!user) return null
  const attempts = await getUserAttempts(user.id)

  return <AppShell>
    <PageTitle eyebrow="Student" title="Results" desc="Your submitted attempts. Detailed scores unlock once an admin releases them." />
    {attempts.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">No attempts yet — finish an assessment to see it here.</div>}
    <div className="stagger space-y-3">
      {attempts.map((a: any) => {
        const released = Boolean(a.result_released_at)
        const pct = released && a.max_score ? Math.round((a.score / a.max_score) * 100) : null
        return <Link key={a.id} href={`/results/${a.id}`} className="card card-hover flex items-center justify-between gap-4 p-5">
          <div>
            <div className="font-bold text-slate-900">{a.assessments?.name ?? 'Assessment'}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Clock size={12} /> {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : 'In progress'}</div>
          </div>
          {released
            ? <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 size={18} /><span className="text-lg font-black">{pct}%</span></div>
            : <div className="flex items-center gap-2 text-amber-500"><Lock size={16} /><span className="text-xs font-semibold">Pending review</span></div>}
        </Link>
      })}
    </div>
  </AppShell>
}
