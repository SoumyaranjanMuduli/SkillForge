import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { sendResultReleasedEmail } from '@/lib/notifications'
import { createNotification } from '@/lib/notifications-store'

const paramsSchema = z.object({ attemptId: z.string().uuid() })

export async function POST(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid attempt id.' }, { status: 400 })
  const attemptId = parsed.data.attemptId
  const db = createAdminClient()

  try {
    const { data: attempt, error: lookupError } = await db
      .from('attempts')
      .select('id,status,result_released_at,user_id,assessments(name)')
      .eq('id', attemptId)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })
    if (!['auto_graded', 'approved'].includes(attempt.status) || attempt.result_released_at) {
      return NextResponse.json({ error: attempt.result_released_at ? 'Result is already released.' : 'Complete all required manual reviews before release.' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { data: released, error: updateError } = await db
      .from('attempts')
      .update({ result_released_at: now, status: 'released' })
      .eq('id', attemptId)
      .in('status', ['auto_graded', 'approved'])
      .is('result_released_at', null)
      .select('id,user_id')
    if (updateError) throw updateError
    if (!released?.length) return NextResponse.json({ error: 'Result was released by another administrator.' }, { status: 409 })

    const assessmentName = Array.isArray(attempt.assessments) ? attempt.assessments[0]?.name ?? 'Assessment' : attempt.assessments?.name ?? 'Assessment'
    const audit = await db.from('audit_logs').insert({ actor_id: adminUser.id, action: 'release_result', entity: 'attempt', entity_id: attemptId, new_value: { releasedAt: now } })
    if (audit.error) console.warn('[release] audit write failed')

    await createNotification({ userId: attempt.user_id, title: `Result released: ${assessmentName}`, message: 'Your administrator has released the result. Open Results to review each question and your feedback.', type: 'result', href: `/results/${attemptId}` })

    try {
      const { data: userResult } = await db.auth.admin.getUserById(attempt.user_id)
      await sendResultReleasedEmail(userResult?.user?.email, assessmentName, attemptId)
    } catch {
      console.warn('[release] email notification failed')
    }

    return NextResponse.json({ ok: true })
  } catch {
    console.error('[release] release failed')
    return NextResponse.json({ error: 'Could not release result.' }, { status: 500 })
  }
}
