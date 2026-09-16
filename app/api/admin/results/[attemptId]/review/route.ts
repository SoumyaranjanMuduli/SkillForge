import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const schema = z.object({
  answerId: z.string().uuid(),
  score: z.number().finite().min(0).max(100000),
  isCorrect: z.boolean().nullable(),
  adminComment: z.string().trim().max(20_000).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { attemptId } = await params
  if (!z.string().uuid().safeParse(attemptId).success) {
    return NextResponse.json({ error: 'Invalid attempt id.' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid review payload.' }, { status: 400 })

  try {
    const db = createAdminClient() as any
    const { data: attempt } = await db
      .from('attempts')
      .select('id,status')
      .eq('id', attemptId)
      .maybeSingle()

    if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })
    if (attempt.status !== 'under_review') {
      return NextResponse.json({ error: 'Attempt is not in a reviewable state.' }, { status: 409 })
    }

    const { data: answer } = await db
      .from('attempt_answers')
      .select('id,attempt_id,question_id,score,is_correct,admin_comment')
      .eq('id', parsed.data.answerId)
      .eq('attempt_id', attemptId)
      .maybeSingle()

    if (!answer) return NextResponse.json({ error: 'Answer not found.' }, { status: 404 })

    const { data: snap } = await db
      .from('attempt_question_snapshots')
      .select('question_snapshot')
      .eq('attempt_id', attemptId)
      .eq('question_id', answer.question_id)
      .maybeSingle()

    if (!snap?.question_snapshot) {
      return NextResponse.json({ error: 'Question snapshot not found; review cannot continue.' }, { status: 409 })
    }

    const maxMarks = Number((snap.question_snapshot as { marks?: number }).marks)
    if (!Number.isFinite(maxMarks) || maxMarks < 0) {
      return NextResponse.json({ error: 'Question scoring configuration is invalid.' }, { status: 409 })
    }
    if (parsed.data.score > maxMarks) {
      return NextResponse.json({ error: `Score cannot exceed ${maxMarks}.` }, { status: 400 })
    }

    const { error: answerError } = await db
      .from('attempt_answers')
      .update({
        score: parsed.data.score,
        is_correct: parsed.data.isCorrect,
        admin_comment: parsed.data.adminComment ?? null,
        reviewed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', answer.id)
      .eq('attempt_id', attemptId)

    if (answerError) throw answerError

    const { data: all, error: answersError } = await db
      .from('attempt_answers')
      .select('score,is_correct,reviewed,question_id,requires_review,grading_status')
      .eq('attempt_id', attemptId)
    if (answersError) throw answersError

    const score = (all ?? []).reduce((n: number, a: any) => n + Number(a.score ?? 0), 0)
    const pendingReview = (all ?? []).filter((a: any) => Boolean(a.requires_review) || ['manual_review', 'failed', 'pending'].includes(String(a.grading_status ?? '').toLowerCase()))
    const allReviewed = pendingReview.every((a: any) => a.reviewed === true)
    const nextStatus = allReviewed ? 'approved' : 'under_review'

    const { error: attemptError } = await db
      .from('attempts')
      .update({ score, status: nextStatus })
      .eq('id', attemptId)
      .eq('status', 'under_review')
    if (attemptError) throw attemptError

    const { error: auditError } = await db.from('audit_logs').insert({
      actor_id: adminUser.id,
      action: 'review_answer',
      entity: 'attempt_answer',
      entity_id: answer.id,
      old_value: { score: answer.score, isCorrect: answer.is_correct, adminComment: answer.admin_comment },
      new_value: parsed.data,
    })
    if (auditError) throw auditError

    return NextResponse.json({ ok: true, score, status: nextStatus })
  } catch {
    console.error('[admin/results/review] failed')
    return NextResponse.json({ error: 'Could not save review.' }, { status: 500 })
  }
}
