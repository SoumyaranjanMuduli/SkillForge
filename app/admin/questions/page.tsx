import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { QuestionsTable } from '@/components/admin/QuestionsTable'

export default async function Questions() {
  await requireAdmin()
  const db = createAdminClient() as any
  const [{ data: q }, { data: p }] = await Promise.all([
    db.from('questions').select('id,program_id,topic,title,question_type,marks,difficulty,status,version,updated_at').order('updated_at', { ascending: false }).limit(500),
    db.from('programs').select('id,name')
  ])
  const pn = new Map((p ?? []).map((x: any) => [x.id, x.name]))
  const rows = (q ?? []).map((x: any) => ({ id: x.id, title: x.title, program: pn.get(x.program_id) || x.program_id, topic: x.topic, question_type: x.question_type, marks: x.marks, difficulty: x.difficulty, status: x.status, version: x.version }))
  const programs = [...new Set(rows.map((r: any) => r.program))] as string[]

  return <AppShell role="admin">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <PageTitle eyebrow="Admin / Questions" title="Question bank" desc="Live question inventory with version and lifecycle state." />
      <div className="flex gap-3">
        <Link href="/admin/questions/new" className="btn-primary"><Plus size={16} /> Add Question</Link>
        <Link href="/admin/questions/import" className="btn-secondary"><Upload size={16} /> Bulk import</Link>
      </div>
    </div>
    <QuestionsTable rows={rows} programs={programs} />
  </AppShell>
}
