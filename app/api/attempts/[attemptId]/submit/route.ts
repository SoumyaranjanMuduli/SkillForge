import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/assessment'
import { gradeAnswer } from '@/lib/grading'
import type { GradingQuestion } from '@/lib/types'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { attemptId } = await params
  if (!(await enforceRateLimit(`attempt-submit:${user.id}:${attemptId}`))) return NextResponse.json({ error:'Too many submit requests. Try again shortly.' }, { status:429 })
  const admin = createAdminClient()
  const { data: attempt } = await admin.from('attempts').select('*').eq('id', attemptId).maybeSingle()
  if (!attempt || attempt.user_id !== user.id) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })
  if (attempt.status !== 'in_progress') return NextResponse.json({ error: 'Attempt is already submitted.' }, { status: 409 })

  // Atomically claim the attempt before grading starts: the update only succeeds for whichever
  // concurrent request (double-click, client retry, etc.) sees status still 'in_progress' at the
  // DB level. Every other concurrent request gets zero rows back here and bails out instead of
  // running the (potentially costly) grading pass a second time. 'submitted' is used as the
  // in-flight/claimed marker; it's set to its real final status ('auto_graded'/'under_review')
  // once grading below completes.
  const { data: claimed } = await admin.from('attempts').update({ status: 'submitted' }).eq('id', attemptId).eq('status', 'in_progress').select('id')
  if (!claimed?.length) return NextResponse.json({ error: 'Attempt is already submitted.' }, { status: 409 })

  try {
    const { data: snapshots } = await admin.from('attempt_question_snapshots').select('*').eq('attempt_id', attemptId)
    const { data: answers } = await admin.from('attempt_answers').select('id,question_id,answer,time_spent_sec').eq('attempt_id', attemptId)
    const answerByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]))
    let score = 0
    let needsReview = false
    for (const snap of snapshots ?? []) {
      const a = answerByQuestion.get(snap.question_id)
      const q = { ...(snap.question_snapshot as object), answerKey: snap.answer_key_snapshot, graderConfig: snap.grader_config_snapshot } as GradingQuestion
      const grade = await gradeAnswer(q, a?.answer ?? '')
      score += grade.score
      if (grade.isCorrect === null || grade.requiresReview) needsReview = true
      if (a) await admin.from('attempt_answers').update({ is_correct: grade.isCorrect, score: grade.score, feedback: grade.feedback, grading_status: grade.gradingStatus ?? (grade.requiresReview ? 'manual_review' : 'completed'), requires_review: Boolean(grade.requiresReview) }).eq('id', a.id)
      else await admin.from('attempt_answers').insert({ attempt_id: attemptId, question_id: snap.question_id, answer: '', is_correct: grade.isCorrect, score: grade.score, feedback: grade.feedback, time_spent_sec: 0, grading_status: grade.gradingStatus ?? (grade.requiresReview ? 'manual_review' : 'completed'), requires_review: Boolean(grade.requiresReview) })
    }
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000))
    const { error } = await admin.from('attempts').update({ submitted_at: new Date().toISOString(), duration_sec: elapsed, score, status: needsReview ? 'under_review' : 'auto_graded', last_activity_at: new Date().toISOString() }).eq('id', attemptId)
    if (error) throw new Error('Could not submit attempt.')
    return NextResponse.json({ ok: true, attemptId })
  } catch (err) {
    // Grading failed after we claimed the attempt — release the claim so the student (or a
    // retry) can submit again instead of the attempt being stuck in 'submitted' limbo forever.
    await admin.from('attempts').update({ status: 'in_progress' }).eq('id', attemptId).eq('status', 'submitted')
    console.error('[attempts/submit] grading failed', err)
    return NextResponse.json({ error: 'Could not submit attempt. Please try again.' }, { status: 500 })
  }
}
