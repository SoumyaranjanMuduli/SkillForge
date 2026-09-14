import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const schema = z.object({ answerId: z.string().uuid(), score: z.number().min(0).max(100000), isCorrect: z.boolean().nullable(), adminComment: z.string().max(20_000).optional() })

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error:'Admin access required' }, { status:403 })
  const { attemptId } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error:'Invalid review payload.' }, { status:400 })
  const admin = createAdminClient()
  const { data: answer } = await admin.from('attempt_answers').select('id,attempt_id,question_id,score,is_correct,admin_comment').eq('id', parsed.data.answerId).eq('attempt_id', attemptId).maybeSingle()
  if (!answer) return NextResponse.json({ error:'Answer not found.' }, { status:404 })
  const { data: attempt } = await admin.from('attempts').select('id,status').eq('id', attemptId).maybeSingle()
  const { data: snap } = await admin.from('attempt_question_snapshots').select('question_snapshot').eq('attempt_id', attemptId).eq('question_id', answer.question_id).maybeSingle()
  const maxMarks = Number((snap?.question_snapshot as { marks?: number } | null)?.marks ?? parsed.data.score)
  if (!attempt || !['under_review','approved'].includes(attempt.status)) return NextResponse.json({ error:'Attempt is not in a reviewable state.' }, { status:409 })
  if (parsed.data.score > maxMarks) return NextResponse.json({ error:`Score cannot exceed ${maxMarks}.` }, { status:400 })
  const { error } = await admin.from('attempt_answers').update({ score:parsed.data.score, is_correct:parsed.data.isCorrect, admin_comment:parsed.data.adminComment ?? null, reviewed:true, updated_at:new Date().toISOString() }).eq('id', answer.id)
  if (error) return NextResponse.json({ error:'Could not save review.' }, { status:500 })
  const { data: all } = await admin.from('attempt_answers').select('score,is_correct,reviewed,question_id,requires_review,grading_status').eq('attempt_id', attemptId)
  const score = (all ?? []).reduce((n, a) => n + Number(a.score ?? 0), 0)
  const pendingReview = (all ?? []).filter((a:any) => Boolean(a.requires_review) || ['manual_review','failed','pending'].includes(String(a.grading_status ?? '').toLowerCase()))
  const allReviewed = pendingReview.every((a:any) => a.reviewed === true)
  await admin.from('attempts').update({ score, status: allReviewed ? 'approved' : 'under_review' }).eq('id', attemptId)
  await admin.from('audit_logs').insert({ actor_id:adminUser.id, action:'review_answer', entity:'attempt_answer', entity_id:answer.id, old_value:{score:answer.score,isCorrect:answer.is_correct,adminComment:answer.admin_comment}, new_value:parsed.data })
  return NextResponse.json({ ok:true, score })
}
