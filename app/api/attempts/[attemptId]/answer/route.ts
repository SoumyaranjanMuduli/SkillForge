import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/assessment'
import { enforceRateLimit } from '@/lib/rate-limit'

const paramsSchema = z.object({ attemptId: z.string().uuid() })
const schema = z.object({
  questionId: z.string().trim().min(1).max(120),
  answer: z.string().max(200_000),
  timeSpentSec: z.number().int().min(0).max(86_400),
})

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const parsedParams = paramsSchema.safeParse(await params)
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid attempt id.' }, { status: 400 })
  const attemptId = parsedParams.data.attemptId
  if (!(await enforceRateLimit(`attempt-answer:${user.id}:${attemptId}`))) return NextResponse.json({ error: 'Too many save requests. Try again shortly.' }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid answer payload.' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('save_attempt_answer_atomic', {
      p_attempt_id: attemptId, p_user_id: user.id, p_question_id: parsed.data.questionId,
      p_answer: parsed.data.answer, p_time_spent_sec: parsed.data.timeSpentSec,
    })
    if (error) {
      const message = String(error.message)
      if (message.includes('ATTEMPT_NOT_FOUND')) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })
      if (message.includes('ATTEMPT_NOT_ACTIVE')) return NextResponse.json({ error: 'Attempt is no longer active.' }, { status: 409 })
      if (message.includes('ATTEMPT_EXPIRED')) return NextResponse.json({ error: 'Assessment time has expired.', expired: true }, { status: 409 })
      if (message.includes('QUESTION_NOT_IN_ATTEMPT')) return NextResponse.json({ error: 'Question does not belong to this attempt.' }, { status: 400 })
      if (message.includes('ANSWER_TOO_LARGE')) return NextResponse.json({ error: 'Answer is too large.' }, { status: 400 })
      throw error
    }
    const row = data?.[0]
    if (!row) throw new Error('No answer-save result returned.')
    return NextResponse.json({ ok: true, savedAt: row.saved_at, serverElapsedSec: row.server_elapsed_sec })
  } catch (err) {
    console.error('[attempts/answer] save failed', err)
    return NextResponse.json({ error: 'Could not save answer.' }, { status: 500 })
  }
}
