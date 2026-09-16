import { Trophy } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { ProgramBarChart } from '@/components/charts/AdminCharts'

export default async function Reports() {
  await requireAdmin()
  const db = createAdminClient() as any
  const [{ data: a }, { data: p }, { data: userAttempts }] = await Promise.all([
    db.from('attempts').select('assessment_id,score,max_score,duration_sec,status'),
    db.from('assessments').select('id,name,program_id,passing_score'),
    db.from('attempts').select('user_id,score,max_score,status,profiles(full_name)').in('status', ['auto_graded', 'approved', 'released'])
  ])
  const pn = new Map<string, any>((p ?? []).map((x: any) => [x.id, x] as [string, any]))
  const { data: programs } = await db.from('programs').select('id,name')
  const programNames = new Map<string, string>((programs ?? []).map((x: any) => [x.id, x.name]))

  const by = new Map<string, any>()
  for (const x of a ?? []) {
    if (!['auto_graded', 'approved', 'released'].includes(x.status)) continue
    const z = by.get(x.assessment_id) || { n: 0, score: 0, time: 0, pass: 0 }
    z.n++; z.score += x.max_score ? x.score / x.max_score * 100 : 0; z.time += x.duration_sec
    const adef = pn.get(x.assessment_id)
    z.pass += x.max_score && x.score / x.max_score * 100 >= Number(adef?.passing_score ?? 60) ? 1 : 0
    by.set(x.assessment_id, z)
  }

  const byProgramScore = new Map<string, { n: number; score: number }>()
  for (const [id, z] of by) {
    const pid = pn.get(id)?.program_id
    if (!pid) continue
    const cur = byProgramScore.get(pid) ?? { n: 0, score: 0 }
    cur.n += z.n; cur.score += z.score
    byProgramScore.set(pid, cur)
  }
  const barData = [...byProgramScore.entries()].map(([pid, v]) => ({ name: programNames.get(pid) || pid, value: v.n ? Math.round(v.score / v.n) : 0 }))

  const byUser = new Map<string, { name: string; n: number; score: number }>()
  for (const x of userAttempts ?? []) {
    if (!x.max_score) continue
    const cur = byUser.get(x.user_id) ?? { name: x.profiles?.full_name || 'User', n: 0, score: 0 }
    cur.n++; cur.score += x.score / x.max_score * 100
    byUser.set(x.user_id, cur)
  }
  const topUsers = [...byUser.values()].map((u) => ({ name: u.name, avg: Math.round(u.score / u.n) })).sort((x, y) => y.avg - x.avg).slice(0, 5)

  return <AppShell role="admin">
    <PageTitle eyebrow="Admin / Reports" title="Performance analytics" desc="Live aggregates from completed attempts." />

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-6">
        <div className="mb-4 font-bold text-slate-900">Average Score by Program</div>
        {barData.length ? <ProgramBarChart data={barData} /> : <div className="py-10 text-center text-sm text-slate-400">Not enough graded attempts yet.</div>}
      </div>
      <div className="card p-6">
        <div className="mb-4 flex items-center gap-2 font-bold text-slate-900"><Trophy size={16} className="text-amber-500" /> Top Performing Users</div>
        <div className="stagger space-y-1">
          {topUsers.map((u, i) => (
            <div key={u.name + i} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                <span className="text-sm font-medium text-slate-700">{u.name}</span>
              </div>
              <span className="text-sm font-bold text-emerald-600">{u.avg}%</span>
            </div>
          ))}
          {topUsers.length === 0 && <div className="py-6 text-center text-sm text-slate-400">No graded attempts yet.</div>}
        </div>
      </div>
    </div>

    <div className="card mt-6 overflow-auto">
      <table className="min-w-[850px] w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"><tr>{['Assessment', 'Attempts', 'Average score', 'Pass rate', 'Average time'].map((x) => <th className="px-5 py-3.5" key={x}>{x}</th>)}</tr></thead>
        <tbody>{[...by.entries()].map(([id, z]) => { const x = pn.get(id); return <tr key={id} className="border-t border-line hover:bg-slate-50/60"><td className="px-5 py-4 font-semibold text-slate-800">{x?.name || id}</td><td className="px-5 py-4 text-slate-500">{z.n}</td><td className="px-5 py-4 text-slate-500">{(z.score / z.n).toFixed(1)}%</td><td className="px-5 py-4 text-slate-500">{(z.pass / z.n * 100).toFixed(1)}%</td><td className="px-5 py-4 text-slate-500">{Math.round(z.time / z.n / 60)}m</td></tr> })}</tbody>
      </table>
    </div>
  </AppShell>
}
