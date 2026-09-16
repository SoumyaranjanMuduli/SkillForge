import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ImportedQuestionSchema } from '@/lib/excel-import'

const commitSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  targetStatus: z.enum(['draft', 'in_review', 'published']),
  rows: z.array(ImportedQuestionSchema).min(1).max(2000),
  lockedProgramId: z.string().min(1).max(80).optional(),
  lockedDifficulty: z.enum(['easy','medium','hard']).optional(),
})

export async function POST(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = commitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { filename, targetStatus } = parsed.data
  const rows = parsed.data.rows.map((r) => ({ ...r, ...(parsed.data.lockedProgramId ? { programId: parsed.data.lockedProgramId } : {}), ...(parsed.data.lockedDifficulty ? { difficulty: parsed.data.lockedDifficulty } : {}) }))

  const ids = rows.map((r) => r.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (duplicates.length) {
    return NextResponse.json({ error: `Duplicate question ids in this batch: ${[...new Set(duplicates)].join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    // Server-revalidate program ids against the live table — the preview step
    // could be stale by the time the admin clicks "import".
    const { data: programs, error: programError } = await admin.from('programs').select('id, slug')
    if (programError) throw programError
    const programMap = new Map((programs ?? []).flatMap((p: { id: string; slug: string }) => [[p.id.toLowerCase(), p.id], [p.slug.toLowerCase(), p.id]] as [string, string][]))
    const invalidProgram = rows.find((r) => !programMap.has(r.programId.toLowerCase()))
    if (invalidProgram) {
      return NextResponse.json({ error: `Program "${invalidProgram.programId}" no longer exists. Re-run the preview.` }, { status: 409 })
    }

    const invalidStatus = rows.find((r) => r.status && !['draft', 'in_review', 'published'].includes(r.status))
    if (invalidStatus) return NextResponse.json({ error: 'One or more question statuses are invalid. Re-run the preview.' }, { status: 409 })

    const dbRows = rows.map((q) => ({
    id: q.id,
    programId: programMap.get(q.programId.toLowerCase()) ?? q.programId,
    topic: q.topic,
    subtopic: q.subtopic ?? null,
    title: q.title,
    prompt: q.prompt,
    questionType: q.questionType,
    difficulty: q.difficulty,
    marks: q.marks,
    timeLimitSec: q.timeLimitSec,
    instructions: q.instructions ?? '',
    starterCode: q.starterCode ?? null,
    choices: q.choices ?? null,
    answerKey: q.answerKey ?? null,
    graderConfig: q.graderConfig ?? {},
    gradingMode: q.gradingMode ?? 'exact',
    explanation: q.explanation ?? null,
    tags: q.tags ?? [],
    status: q.status ?? targetStatus,
    }))

    const { data: batchId, error: importError } = await admin.rpc('commit_question_import_atomic', {
      p_filename: filename,
      p_target_status: targetStatus,
      p_rows: dbRows,
      p_actor: adminUser.id,
    })

    if (importError || !batchId) {
      console.error('[questions/import/commit] atomic import failed', importError)
      return NextResponse.json({ error: 'Could not save imported questions. No changes were committed.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: dbRows.length, batchId })
  } catch {
    console.error('[questions/import/commit] unexpected failure')
    return NextResponse.json({ error: 'Could not save imported questions. No changes were committed.' }, { status: 500 })
  }
}
