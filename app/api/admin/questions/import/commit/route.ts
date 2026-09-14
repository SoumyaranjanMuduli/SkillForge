import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ImportedQuestionSchema } from '@/lib/excel-import'

const commitSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  targetStatus: z.enum(['draft', 'in_review', 'published']),
  rows: z.array(ImportedQuestionSchema).min(1).max(2000),
})

export async function POST(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = commitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { filename, targetStatus, rows } = parsed.data

  const ids = rows.map((r) => r.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (duplicates.length) {
    return NextResponse.json({ error: `Duplicate question ids in this batch: ${[...new Set(duplicates)].join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Server-revalidate program ids against the live table — the preview step
  // could be stale by the time the admin clicks "import".
  const { data: programs } = await admin.from('programs').select('id, slug')
  const programMap = new Map((programs ?? []).flatMap((p: { id: string; slug: string }) => [[p.id.toLowerCase(), p.id], [p.slug.toLowerCase(), p.id]] as [string, string][]))
  const invalidProgram = rows.find((r) => !programMap.has(r.programId.toLowerCase()))
  if (invalidProgram) {
    return NextResponse.json({ error: `Program "${invalidProgram.programId}" no longer exists. Re-run the preview.` }, { status: 409 })
  }

  const invalidStatus = rows.find((r) => r.status && !['draft', 'in_review', 'published'].includes(r.status))
  if (invalidStatus) return NextResponse.json({ error: 'One or more question statuses are invalid. Re-run the preview.' }, { status: 409 })

  const { data: existing } = await admin.from('questions').select('*').in('id', ids)
  if (existing?.length) {
    const { error: versionError } = await admin.from('question_versions').insert(
      existing.map((old: { id: string; version: number }) => ({ question_id: old.id, version: old.version, snapshot: old, created_by: adminUser.id }))
    )
    if (versionError) return NextResponse.json({ error: 'Could not preserve question version history. Nothing was imported.' }, { status: 500 })
  }
  const versions = new Map((existing ?? []).map((q: { id: string; version: number }) => [q.id, q.version]))

  const dbRows = rows.map((q) => ({
    id: q.id,
    program_id: programMap.get(q.programId.toLowerCase()) ?? q.programId,
    topic: q.topic,
    subtopic: q.subtopic ?? null,
    title: q.title,
    prompt: q.prompt,
    question_type: q.questionType,
    difficulty: q.difficulty,
    marks: q.marks,
    time_limit_sec: q.timeLimitSec,
    instructions: q.instructions ?? '',
    starter_code: q.starterCode ?? null,
    choices: q.choices ?? null,
    answer_key: q.answerKey ?? null,
    grader_config: q.graderConfig ?? {},
    grading_mode: q.gradingMode ?? 'exact',
    explanation: q.explanation ?? null,
    tags: q.tags ?? [],
    // A row's own `status` column (if present and valid) wins over the
    // batch-wide target so a mixed import (some rows already reviewed) works.
    status: q.status ?? targetStatus,
    version: (versions.get(q.id) ?? 0) + 1,
    created_by: adminUser.id,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin.from('questions').upsert(dbRows)
  if (error) return NextResponse.json({ error: 'Could not save imported questions.' }, { status: 500 })

  const { data: batch, error: batchError } = await admin
    .from('question_import_batches')
    .insert({
      filename,
      uploaded_by: adminUser.id,
      row_count: rows.length,
      valid_count: rows.length,
      error_count: 0,
      target_status: targetStatus,
      status: 'committed',
      question_ids: ids,
      committed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  await admin.from('audit_logs').insert(
    dbRows.map((q) => ({ actor_id: adminUser.id, action: 'import_question', entity: 'question', entity_id: q.id, new_value: { version: q.version, status: q.status, batchId: batch?.id ?? null } }))
  )

  return NextResponse.json({ ok: true, count: dbRows.length, batchId: batch?.id ?? null, batchError: batchError ? 'Batch was committed but could not be logged.' : undefined })
}
