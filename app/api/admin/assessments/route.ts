import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const questionSchema = z.union([
  z.string().trim().min(1).max(120),
  z.object({
    questionId: z.string().trim().min(1).max(120),
    marksOverride: z.number().int().positive().max(10_000).nullable().optional(),
    timeLimitOverrideSec: z.number().int().positive().max(86_400).nullable().optional(),
  }),
])

const schema = z.object({
  id: z.string().trim().min(2).max(120),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(''),
  programId: z.string().trim().min(1).max(120),
  durationSec: z.number().int().positive().max(86_400),
  passingScore: z.number().min(0).max(100).default(60),
  maxAttempts: z.number().int().min(0).max(100).default(0),
  randomizeQuestions: z.boolean().default(false),
  randomizeOptions: z.boolean().default(false),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  published: z.boolean().default(false),
  questionIds: z.array(questionSchema).min(1).max(500),
}).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && new Date(value.startDate) > new Date(value.endDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'endDate must be on or after startDate.' })
  }
})

export async function POST(req: Request) {
  const actor = await requireAdmin().catch(() => null)
  if (!actor) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const db = createAdminClient()
    const ids = parsed.data.questionIds.map(q => typeof q === 'string' ? q : q.questionId)
    if (new Set(ids).size !== ids.length) return NextResponse.json({ error: 'Each question may only appear once.' }, { status: 400 })

    const { data: valid, error } = await db.from('questions').select('id,program_id,status').in('id', ids)
    if (error) throw error
    if ((valid ?? []).length !== ids.length || (valid ?? []).some(q => q.program_id !== parsed.data.programId)) {
      return NextResponse.json({ error: 'All selected questions must exist and belong to the selected program.' }, { status: 400 })
    }
    if (parsed.data.published && (valid ?? []).some(q => q.status !== 'published')) {
      return NextResponse.json({ error: 'Published assessments can only contain published questions.' }, { status: 400 })
    }

    const assessment = { ...parsed.data, startDate: parsed.data.startDate ?? null, endDate: parsed.data.endDate ?? null }
    const questions = parsed.data.questionIds.map((q, position) => ({
      questionId: typeof q === 'string' ? q : q.questionId,
      position: position + 1,
      marksOverride: typeof q === 'string' ? null : q.marksOverride ?? null,
      timeLimitOverrideSec: typeof q === 'string' ? null : q.timeLimitOverrideSec ?? null,
    }))

    const { error: rpcError } = await db.rpc('save_assessment_atomic', { p_assessment: assessment, p_questions: questions, p_actor: actor.id })
    if (rpcError) throw rpcError

    const { error: auditError } = await db.from('audit_logs').insert({ actor_id: actor.id, action: 'upsert_assessment', entity: 'assessment', entity_id: parsed.data.id, new_value: { ...assessment, questionIds: ids } })
    if (auditError) console.warn('[admin/assessments] audit write failed')
    return NextResponse.json({ ok: true, id: parsed.data.id })
  } catch {
    console.error('[admin/assessments] save failed')
    return NextResponse.json({ error: 'Could not save assessment.' }, { status: 500 })
  }
}
