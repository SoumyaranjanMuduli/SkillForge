import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const schema = z.object({
  id: z.string().trim().min(2).max(120),
  topicId: z.string().uuid().nullable().optional(),
  programId: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(200),
  subtopic: z.string().trim().max(200).nullable().optional(),
  title: z.string().trim().min(1).max(500),
  prompt: z.string().min(1).max(50_000),
  questionType: z.enum(['mcq','multi_select','true_false','text','numeric','sql','python','excel','code','data_engineering','case_study','manual_review']),
  difficulty: z.enum(['easy','medium','hard']),
  marks: z.number().int().positive().max(1000),
  timeLimitSec: z.number().int().positive().max(86_400),
  instructions: z.string().max(20_000).optional(),
  starterCode: z.string().max(100_000).nullable().optional(),
  choices: z.array(z.string().max(1000)).max(100).nullable().optional(),
  answerKey: z.string().max(100_000).nullable().optional(),
  graderConfig: z.record(z.unknown()).optional(),
  gradingMode: z.string().max(80).optional(),
  explanation: z.string().max(20_000).optional(),
  status: z.enum(['draft', 'in_review', 'published', 'archived']).optional(),
})

const questionFields = {
  programId: 'program_id', topicId: 'topic_id', questionType: 'question_type', timeLimitSec: 'time_limit_sec',
  starterCode: 'starter_code', answerKey: 'answer_key', graderConfig: 'grader_config', gradingMode: 'grading_mode',
} as const

function mapPatch(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue
    out[questionFields[key as keyof typeof questionFields] ?? key] = value
  }
  out.updated_at = new Date().toISOString()
  return out
}

export async function POST(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = z.array(schema).max(500).safeParse(Array.isArray(body) ? body : [body])
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data: programs, error: programError } = await admin.from('programs').select('id')
    if (programError) throw programError
    const programIds = new Set((programs ?? []).map(p => p.id))
    const invalidProgram = parsed.data.find(q => !programIds.has(q.programId))
    if (invalidProgram) return NextResponse.json({ error: `Program "${invalidProgram.programId}" does not exist.` }, { status: 400 })

    const ids = parsed.data.map(q => q.id)
    if (new Set(ids).size !== ids.length) return NextResponse.json({ error: 'Duplicate question ids in this request.' }, { status: 400 })

    const { data: existing, error: existingError } = await admin.from('questions').select('id,version,status').in('id', ids)
    if (existingError) throw existingError
    const existingById = new Map((existing ?? []).map(q => [q.id, q]))
    const rows = parsed.data.map(q => ({
      id: q.id, program_id: q.programId, topic: q.topic, topic_id: q.topicId ?? null, subtopic: q.subtopic ?? null,
      title: q.title, prompt: q.prompt, question_type: q.questionType, difficulty: q.difficulty, marks: q.marks,
      time_limit_sec: q.timeLimitSec, instructions: q.instructions ?? '', starter_code: q.starterCode ?? null,
      choices: q.choices ?? null, answer_key: q.answerKey ?? null, grader_config: q.graderConfig ?? {},
      grading_mode: q.gradingMode ?? 'exact', explanation: q.explanation ?? null,
      status: q.status ?? existingById.get(q.id)?.status ?? 'draft',
    }))
    const { data: savedCount, error: saveError } = await admin.rpc('upsert_questions_atomic', { p_rows: rows, p_actor: adminUser.id })
    if (saveError) throw saveError
    return NextResponse.json({ count: Number(savedCount ?? rows.length) })
  } catch {
    console.error('[admin/questions] upsert failed')
    return NextResponse.json({ error: 'Could not save questions.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = schema.partial().extend({ id: z.string().trim().min(2).max(120) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const db = createAdminClient()
    const q = parsed.data
    const { data: old, error: oldError } = await db.from('questions').select('*').eq('id', q.id).maybeSingle()
    if (oldError) throw oldError
    if (!old) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })

    if (q.status) {
      const allowed = q.status === old.status ||
        (old.status === 'draft' && ['in_review', 'archived'].includes(q.status)) ||
        (old.status === 'in_review' && ['published', 'archived'].includes(q.status)) ||
        (old.status === 'published' && q.status === 'archived')
      if (!allowed) return NextResponse.json({ error: `Invalid status transition: ${old.status} → ${q.status}.` }, { status: 409 })
    }

    const patch = mapPatch(q)
    const { data: version, error: updateError } = await db.rpc('update_question_atomic', { p_question: { id: q.id, ...patch }, p_actor: adminUser.id, p_expected_version: old.version })
    if (updateError) {
      if (String(updateError.message).includes('QUESTION_MODIFIED')) return NextResponse.json({ error: 'Question was modified by another administrator. Reload and try again.' }, { status: 409 })
      if (String(updateError.message).includes('QUESTION_NOT_FOUND')) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
      throw updateError
    }
    return NextResponse.json({ ok: true, version: Number(version) })
  } catch {
    console.error('[admin/questions] patch failed')
    return NextResponse.json({ error: 'Could not update question.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (!id || id.length > 120) return NextResponse.json({ error: 'Question id is required.' }, { status: 400 })

  try {
    const db = createAdminClient()
    const { data: old, error: oldError } = await db.from('questions').select('id,version,status').eq('id', id).maybeSingle()
    if (oldError) throw oldError
    if (!old) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    const { data: version, error } = await db.rpc('update_question_atomic', { p_question: { id, status: 'archived' }, p_actor: adminUser.id, p_expected_version: old.version })
    if (error) {
      if (String(error.message).includes('QUESTION_MODIFIED')) return NextResponse.json({ error: 'Question was modified by another administrator. Reload and try again.' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ ok: true, version: Number(version) })
  } catch {
    console.error('[admin/questions] archive failed')
    return NextResponse.json({ error: 'Could not archive question.' }, { status: 500 })
  }
}
