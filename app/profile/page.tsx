import { Mail, ShieldCheck, UserRound } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { getServerUser, getUserProgressSummary } from '@/lib/assessment'
import { AnimatedNumber } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await getServerUser()
  if (!user) return null
  const progress = await getUserProgressSummary(user.id)

  return <AppShell>
    <PageTitle eyebrow="Student" title="Profile" desc="Your account and lifetime practice stats." />
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="card flex flex-col items-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-brand/10 text-2xl font-black text-brand animate-pop-in"><UserRound size={32} /></div>
        <div className="mt-4 font-bold text-slate-900">{user.email?.split('@')[0]}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Mail size={12} /> {user.email}</div>
        <div className="badge-brand mt-4 flex items-center gap-1"><ShieldCheck size={12} /> Verified account</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-6"><div className="text-xs font-semibold uppercase text-slate-400">Assessments</div><div className="mt-2 text-3xl font-black text-slate-900"><AnimatedNumber value={progress.totalAssessments} /></div></div>
        <div className="card p-6"><div className="text-xs font-semibold uppercase text-slate-400">Completed</div><div className="mt-2 text-3xl font-black text-slate-900"><AnimatedNumber value={progress.completed} /></div></div>
        <div className="card p-6"><div className="text-xs font-semibold uppercase text-slate-400">Average score</div><div className="mt-2 text-3xl font-black text-slate-900"><AnimatedNumber value={progress.avgScore} suffix="%" /></div></div>
      </div>
    </div>
  </AppShell>
}
