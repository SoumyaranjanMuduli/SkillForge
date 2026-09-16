import { AppShell, PageTitle } from '@/components/AppShell'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ENTITIES = ['program', 'topic', 'question', 'assessment', 'profile'] as const

function fmt(v: unknown) {
  if (v == null) return '—'
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 160 ? s.slice(0, 160) + '…' : s
}

export default async function AuditLogs({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await requireAdmin()
  const { entity } = await searchParams
  const db = createAdminClient() as any
  let q = db.from('audit_logs').select('id,actor_id,action,entity,entity_id,old_value,new_value,created_at,profiles(full_name)').order('created_at', { ascending: false }).limit(200)
  if (entity && (ENTITIES as readonly string[]).includes(entity)) q = q.eq('entity', entity)
  const { data: logs } = await q

  return <AppShell role="admin">
    <PageTitle eyebrow="Admin / Audit Logs" title="Audit log" desc="Every admin mutation, in order. Backed by the audit_logs table — nothing here is filtered by role, this is the full trail." />
    <div className="card mb-4 flex flex-wrap gap-2 p-4">
      <a href="/admin/audit-logs" className={`badge ${!entity ? '!bg-brand !text-white' : ''}`}>All</a>
      {ENTITIES.map(e => <a key={e} href={`/admin/audit-logs?entity=${e}`} className={`badge ${entity === e ? '!bg-brand !text-white' : ''}`}>{e}</a>)}
    </div>
    <div className="card overflow-auto">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-5 py-4">When</th>
            <th className="px-5 py-4">Actor</th>
            <th className="px-5 py-4">Action</th>
            <th className="px-5 py-4">Entity</th>
            <th className="px-5 py-4">Entity ID</th>
            <th className="px-5 py-4">Change</th>
          </tr>
        </thead>
        <tbody>
          {(logs ?? []).map((l: any) => (
            <tr key={l.id} className="border-t border-line align-top">
              <td className="whitespace-nowrap px-5 py-4 text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
              <td className="px-5 py-4 font-semibold">{l.profiles?.full_name || l.actor_id || 'system'}</td>
              <td className="px-5 py-4">{l.action}</td>
              <td className="px-5 py-4 text-slate-500">{l.entity}</td>
              <td className="px-5 py-4 font-mono text-xs text-slate-500">{l.entity_id ?? '—'}</td>
              <td className="max-w-md px-5 py-4 font-mono text-xs text-slate-500">
                {l.old_value && <div>old: {fmt(l.old_value)}</div>}
                <div>new: {fmt(l.new_value)}</div>
              </td>
            </tr>
          ))}
          {!logs?.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No audit entries yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </AppShell>
}
