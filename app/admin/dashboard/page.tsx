import { Award, BookOpen, ClipboardCheck, FileQuestion, TrendingUp, Users } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { ActivityLineChart, ProgramDonutChart } from '@/components/charts/AdminCharts'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  await requireAdmin()
  const db = createAdminClient() as any
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [u, p, q, a, at, submitted, pending, scored, assessments, recentAttempts, assessmentsByProgram, programNames] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('assessments').select('id', { count: 'exact', head: true }).eq('published', true),
    db.from('attempts').select('id', { count: 'exact', head: true }),
    db.from('attempts').select('id', { count: 'exact', head: true }).not('submitted_at', 'is', null),
    db.from('attempts').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
    db.from('attempts').select('assessment_id,score,max_score').in('status', ['auto_graded', 'approved', 'released']),
    db.from('assessments').select('id,passing_score,program_id'),
    db.from('attempts').select('submitted_at').gte('submitted_at', since).not('submitted_at', 'is', null),
    db.from('assessments').select('program_id'),
    db.from('programs').select('id,name')
  ])

  const rows = scored.data ?? []
  const thresholds = new Map((assessments.data ?? []).map((x: any) => [x.id, Number(x.passing_score)]))
  const avg = rows.length ? rows.reduce((n: any, x: any) => n + Number(x.max_score ? x.score / x.max_score * 100 : 0), 0) / rows.length : 0
  const pass = rows.length ? rows.filter((x: any) => Number(x.max_score) > 0 && (Number(x.score) / Number(x.max_score) * 100) >= Number(thresholds.get(x.assessment_id) ?? 60)).length / rows.length * 100 : 0

  const stats = [
    { label: 'Total Users', value: u.count ?? 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Total Assessments', value: at.count ?? 0, icon: ClipboardCheck, color: 'bg-purple-50 text-purple-600' },
    { label: 'Questions', value: q.count ?? 0, icon: FileQuestion, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Average Score', value: `${avg.toFixed(0)}%`, icon: Award, color: 'bg-amber-50 text-amber-600' }
  ]
  const extra = [
    ['Programs', p.count ?? 0], ['Published assessments', a.count ?? 0], ['Completed', submitted.count ?? 0],
    ['Pending reviews', pending.count ?? 0], ['Pass rate', `${pass.toFixed(0)}%`]
  ] as const

  const dayCounts = new Map<string, number>()
  for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dayCounts.set(d.toISOString().slice(0, 10), 0) }
  for (const r of recentAttempts.data ?? []) { const k = String(r.submitted_at).slice(0, 10); if (dayCounts.has(k)) dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1) }
  const activity = [...dayCounts.entries()].map(([day, count]) => ({ day: day.slice(5), count }))

  const pn = new Map<string, string>((programNames.data ?? []).map((x: any) => [x.id, x.name]))
  const byProgram = new Map<string, number>()
  for (const a2 of assessmentsByProgram.data ?? []) { const name = pn.get(a2.program_id) || 'Other'; byProgram.set(name, (byProgram.get(name) ?? 0) + 1) }
  const donutData = [...byProgram.entries()].map(([name, value]) => ({ name, value }))

  return <AppShell role="admin">
    <PageTitle eyebrow="Admin / Dashboard" title="Live operations" desc="All figures below are calculated from Supabase; no demo counters are used." />
    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="card card-hover p-5">
          <div className="flex items-center justify-between">
            <div className={`grid h-11 w-11 place-items-center rounded-xl ${s.color}`}><s.icon size={20} /></div>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><TrendingUp size={12} /> live</span>
          </div>
          <div className="mt-4 text-2xl font-black text-slate-900">{s.value}</div>
          <div className="mt-1 text-xs text-slate-400">{s.label}</div>
        </div>
      ))}
    </div>

    <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {extra.map(([k, v]) => <div key={String(k)} className="card p-4"><div className="text-xl font-black text-slate-900">{v}</div><div className="mt-1 text-xs text-slate-400">{k}</div></div>)}
    </div>

    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="card p-6">
        <div className="mb-1 flex items-center gap-2 font-bold text-slate-900"><BookOpen size={16} className="text-brand" /> User Activity</div>
        <div className="mb-4 text-xs text-slate-400">Attempts submitted, last 30 days</div>
        <ActivityLineChart data={activity} />
      </div>
      <div className="card p-6">
        <div className="mb-4 font-bold text-slate-900">Assessments by Program</div>
        {donutData.length ? <ProgramDonutChart data={donutData} /> : <div className="py-10 text-center text-sm text-slate-400">No assessments yet.</div>}
      </div>
    </div>
  </AppShell>
}
