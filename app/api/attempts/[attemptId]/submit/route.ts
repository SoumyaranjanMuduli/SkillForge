import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/assessment'
import { gradeAnswer } from '@/lib/grading'
import type { GradingQuestion } from '@/lib/types'
import { enforceRateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications-store'

const paramsSchema = z.object({ attemptId: z.string().uuid() })

export async function POST(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const rawParams = await params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json({ error: 'Invalid attempt id.' }, { status: 400 })
  const attemptId = parsedParams.data.attemptId

  if (!(await enforceRateLimit(`attempt-submit:${user.id}:${attemptId}`))) {
    return NextResponse.json({ error: 'Too many submit requests. Try again shortly.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { data: attempt, error: attemptError } = await admin
    .from('attempts')
    .select('id,user_id,status,started_at,assessment_id,max_score')
    .eq('id', attemptId)
    .maybeSingle()

  if (attemptError) {
    console.error('[attempts/submit] attempt lookup failed', attemptError)
    return NextResponse.json({ error: 'Could not load attempt.' }, { status: 500 })
  }
  if (!attempt || attempt.user_id !== user.id) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })
  if (attempt.status !== 'in_progress') return NextResponse.json({ error: 'Attempt is already submitted.' }, { status: 409 })

  const { data: assessment, error: assessmentError } = await admin
    .from('assessments')
    .select('name,duration_sec')
    .eq('id', attempt.assessment_id)
    .maybeSingle()
  if (assessmentError || !assessment) return NextResponse.json({ error: 'Assessment configuration not found.' }, { status: 500 })

  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000))
  const expired = elapsed >= assessment.duration_sec

  const { data: claimed, error: claimError } = await admin
    .from('attempts')
    .update({ status: 'submitted', last_activity_at: new Date().toISOString() })
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .select('id')

  if (claimError) {
    console.error('[attempts/submit] claim failed', claimError)
    return NextResponse.json({ error: 'Could not submit attempt.' }, { status: 500 })
  }
  if (!claimed?.length) return NextResponse.json({ error: 'Attempt is already being submitted.' }, { status: 409 })

  try {
    const [{ data: snapshots, error: snapshotError }, { data: answers, error: answersError }] = await Promise.all([
      admin.from('attempt_question_snapshots').select('*').eq('attempt_id', attemptId).order('created_at', { ascending: true }),
      admin.from('attempt_answers').select('id,question_id,answer,time_spent_sec').eq('attempt_id', attemptId),
    ])
    if (snapshotError || answersError || !snapshots?.length) throw new Error('Could not load attempt data.')

    const answerByQuestion = new Map((answers ?? []).map(a => [a.question_id, a]))
    const updates: Record<string, unknown>[] = []
    let score = 0
    let needsReview = expired

    for (const snap of snapshots) {
      const a = answerByQuestion.get(snap.question_id)
      const q = {
        ...(snap.question_snapshot as object),
        answerKey: snap.answer_key_snapshot,
        graderConfig: snap.grader_config_snapshot,
      } as GradingQuestion
      const grade = await gradeAnswer(q, a?.answer ?? '')
      score += grade.score
      if (grade.isCorrect === null || grade.requiresReview) needsReview = true
      updates.push({
        questionId: snap.question_id,
        answer: a?.answer ?? '',
        isCorrect: grade.isCorrect,
        score: grade.score,
        feedback: grade.feedback,
        timeSpentSec: Math.max(0, Math.min(Number(a?.time_spent_sec ?? 0), elapsed)),
        gradingStatus: grade.gradingStatus ?? (grade.requiresReview ? 'manual_review' : 'completed'),
        requiresReview: Boolean(grade.requiresReview),
      })
    }

    if (expired) score = Math.max(0, Math.min(Number(attempt.max_score), score))
    const finalStatus = needsReview ? 'under_review' : 'auto_graded'
    const { error: finalizeError } = await admin.rpc('finalize_attempt_atomic', {
      p_attempt_id: attemptId,
      p_user_id: user.id,
      p_status: finalStatus,
      p_submitted_at: new Date().toISOString(),
      p_duration_sec: elapsed,
      p_score: score,
      p_updates: updates,
    })
    if (finalizeError) throw finalizeError

    await createNotification({
      userId: user.id,
      title: `Assessment submitted: ${assessment.name}`,
      message: needsReview
        ? 'Your submission is under administrator review. You’ll be notified when the result is released.'
        : 'Your submission has been graded. Your result will appear here as soon as it is released.',
      type: 'assessment',
      href: `/results/${attemptId}`,
    })

    return NextResponse.json({ ok: true, attemptId, expired, status: finalStatus })
  } catch (err) {
    console.error('[attempts/submit] grading/finalization failed', err)
    await admin.from('attempts').update({ status: 'in_progress' }).eq('id', attemptId).eq('status', 'submitted')
    return NextResponse.json({ error: 'Could not submit attempt. Please try again.' }, { status: 500 })
  }
}
