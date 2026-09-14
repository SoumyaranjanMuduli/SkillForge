import Link from 'next/link'
import { ArrowRight, BarChart3, CalendarDays, ClipboardList, Quote, Trophy } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { getAssessmentsForUser, getPrograms, getServerUser, getUserProgressSummary } from '@/lib/assessment'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActivityHeatmap, AnimatedNumber, ProgressBar } from '@/components/ui'
import { programVisual } from '@/lib/ui-helpers'
import type { Assessment, Program } from '@/lib/types'

export const dynamic = 'force-dynamic'

const QUOTES = ['Small progress each day leads to big results.', 'Consistency beats intensity.', 'The best time to practice was yesterday. The next best time is now.']

export default async function DashboardPage() {
  const user = await getServerUser()
  if (!user) return null
  const [assessments, programs, progress] = await Promise.all([
    getAssessmentsForUser(user.id),
    getPrograms(),
    getUserProgressSummary(user.id)
  ])
  let firstName = user.email?.split('@')[0] ?? 'there'
  try {
    const admin = createAdminClient() as any
    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    if (profile?.full_name) firstName = String(profile.full_name).split(' ')[0]
  } catch { /* demo mode has no profiles table wired the same way */ }
  const quote = QUOTES[new Date().getDate() % QUOTES.length]

  return <AppShell>
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Welcome back, {firstName}!</h1>
        <p className="mt-1 text-sm text-slate-500">Keep learning. Keep growing.</p>
      </div>
      <div className="badge-brand flex max-w-xs items-center gap-2 !py-2 !px-4 text-left">
        <Quote size={14} className="shrink-0" /> <span className="text-xs font-medium leading-4">&ldquo;{quote}&rdquo;</span>
      </div>
    </div>

    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {programs.slice(0, 4).map((p: Program) => {
        const { Icon, bg, text } = programVisual(p.name)
        const count = assessments.filter((a: Assessment) => a.programId === p.id).length
        return <div key={p.id} className="card card-hover p-5">
          <div className={`grid h-11 w-11 place-items-center rounded-xl ${bg} ${text}`}><Icon size={22} /></div>
          <h3 className="mt-4 font-bold text-slate-900">{p.name}</h3>
          <p className="text-xs text-slate-400">{count || '10+'} Questions</p>
          <Link href={`/practice?program=${p.id}`} className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold ${text}`}>Start Practice <ArrowRight size={14} /></Link>
        </div>
      })}
    </div>

    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_.7fr]">
      <div className="card p-6">
        <h3 className="font-bold text-slate-900">Your Progress</h3>
        <div className="mt-5 space-y-4">
          {progress.perProgram.map((p) => {
            const { bar } = programVisual(p.name)
            return <div key={p.programId}>
              <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium text-slate-600">{p.name}</span><span className="font-semibold text-slate-400">{p.pct}%</span></div>
              <ProgressBar pct={p.pct} colorClass={bar} />
            </div>
          })}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-slate-900">Activity This Month</h3>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><CalendarDays size={12} /> last 10 weeks</div>
        <div className="mt-4 overflow-x-auto"><ActivityHeatmap dates={progress.activityDates} /></div>
      </div>

      <div className="card flex flex-col justify-between gap-5 p-6">
        <Stat icon={ClipboardList} label="Total Assessments" value={progress.totalAssessments} />
        <Stat icon={Trophy} label="Completed" value={progress.completed} />
        <Stat icon={BarChart3} label="Average Score" value={progress.avgScore} suffix="%" />
      </div>
    </div>

    <div className="mt-10 flex items-center justify-between">
      <h2 className="text-lg font-bold text-slate-900">Continue learning</h2>
      <Link href="/assessments" className="text-sm font-semibold text-brand hover:underline">View all</Link>
    </div>
    <div className="stagger mt-4 grid gap-4 lg:grid-cols-2">
      {assessments.slice(0, 4).map((a: Assessment) => {
        const p = programs.find((x: Program) => x.id === a.programId)
        return <div key={a.id} className="card card-hover p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="badge">{p?.name ?? a.programId}</div>
              <h2 className="mt-4 text-xl font-bold text-slate-900">{a.name}</h2>
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

function Stat({ icon: Icon, label, value, suffix = '' }: { icon: typeof Trophy; label: string; value: number; suffix?: string }) {
  return <div>
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><Icon size={14} className="text-brand" /> {label}</div>
    <div className="mt-1 text-3xl font-black text-slate-900"><AnimatedNumber value={value} suffix={suffix} /></div>
  </div>
}
