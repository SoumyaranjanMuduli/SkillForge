import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/assessment'
import { enforceRateLimit } from '@/lib/rate-limit'

const schema = z.object({ questionId: z.string().min(1), answer: z.string().max(200_000), timeSpentSec: z.number().int().min(0).max(86_400) })

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { attemptId } = await params
  if (!(await enforceRateLimit(`attempt-answer:${user.id}:${attemptId}`))) return NextResponse.json({ error:'Too many save requests. Try again shortly.' }, { status:429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid answer payload.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: attempt } = await admin.from('attempts').select('id,user_id,status,started_at,assessment_id').eq('id', attemptId).maybeSingle()
  if (!attempt || attempt.user_id !== user.id) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })
  if (attempt.status !== 'in_progress') return NextResponse.json({ error: 'Attempt is no longer active.' }, { status: 409 })
  const { data: assessment } = await admin.from('assessments').select('duration_sec').eq('id', attempt.assessment_id).single()
  const elapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000)
  if (!assessment || elapsed >= assessment.duration_sec) return NextResponse.json({ error: 'Assessment time has expired.', expired: true }, { status: 409 })
  const { data: snapshot } = await admin.from('attempt_question_snapshots').select('question_id').eq('attempt_id', attemptId).eq('question_id', parsed.data.questionId).maybeSingle()
  if (!snapshot) return NextResponse.json({ error: 'Question does not belong to this attempt.' }, { status: 400 })
  const safeTime = Math.min(parsed.data.timeSpentSec, elapsed)
  const { error } = await admin.from('attempt_answers').upsert({ attempt_id: attemptId, question_id: parsed.data.questionId, answer: parsed.data.answer, time_spent_sec: safeTime, updated_at: new Date().toISOString() }, { onConflict: 'attempt_id,question_id' })
  if (error) return NextResponse.json({ error: 'Could not save answer.' }, { status: 500 })
  await admin.from('attempts').update({ last_activity_at: new Date().toISOString() }).eq('id', attemptId)
  await admin.from('activity_logs').insert({ user_id:user.id, attempt_id:attemptId, action:'answer_saved', metadata:{ questionId:parsed.data.questionId, timeSpentSec:safeTime } })
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString(), serverElapsedSec: elapsed })
}
