import Link from 'next/link'
import { Clock, Hourglass } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { getAttempt } from '@/lib/result'
import { ScoreRing } from '@/components/ScoreRing'
import { ResultsTabs } from '@/components/ResultsTabs'

export const dynamic = 'force-dynamic'

type AttemptAnswerView = {
  question_id: string
  answer?: string
  is_correct?: boolean | null
  score?: number
  time_spent_sec: number
  admin_comment?: string | null
  feedback?: string | null
}

export default async function ResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const attempt = await getAttempt(attemptId)
  if (!attempt) return <div className="grid min-h-screen place-items-center bg-surface p-6"><div className="card p-8"><h1 className="text-xl font-bold text-slate-900">Result not found</h1><Link href="/dashboard" className="btn-primary mt-5">Dashboard</Link></div></div>

  const released = Boolean(attempt.result_released_at)
  const answers = (attempt.attempt_answers ?? []) as AttemptAnswerView[]
  const pct = released && attempt.max_score ? Math.round((attempt.score! / attempt.max_score) * 100) : 0

  return <AppShell>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
      <PageTitle eyebrow="Result" title={attempt.assessments?.name ?? 'Assessment result'} desc="Detailed answers remain hidden until the administrator releases the result." />
      <span className={`badge-brand ${released ? '' : '!bg-amber-50 !text-amber-600'}`}>{released ? 'Completed' : 'Under review'}</span>
    </div>

    <div className="card p-6 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
          <Metric label="Score" value={released ? `${attempt.score}/${attempt.max_score}` : 'Locked'} />
          <Metric label="Correct" value={released ? String(answers.filter((a) => a.is_correct === true).length) : '—'} />
          <Metric label="Wrong" value={released ? String(answers.filter((a) => a.is_correct === false).length) : '—'} />
        </div>
        {released
          ? <ScoreRing pct={pct} />
          : <div className="grid h-28 w-28 place-items-center rounded-full border-4 border-dashed border-amber-200 text-amber-500"><Hourglass size={26} /></div>}
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400"><Clock size={13} /> {formatSeconds(attempt.duration_sec)} spent</div>
      {!released && <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">Assessment submitted. An administrator needs to review the attempt and release the result.</div>}
    </div>

    {released && <ResultsTabs answers={answers} pct={pct} />}
  </AppShell>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-slate-50 p-4"><div className="text-xl font-black text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-400">{label}</div></div>
}
function formatSeconds(sec: number) { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}m ${String(s).padStart(2, '0')}s` }
