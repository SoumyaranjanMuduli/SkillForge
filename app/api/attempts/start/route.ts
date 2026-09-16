import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessibleAssessment, getQuestionsForGrading, getServerUser } from '@/lib/assessment'
import { enforceRateLimit } from '@/lib/rate-limit'

const bodySchema = z.object({ assessmentId: z.string().trim().min(1).max(120) })

function shuffle<T>(items: T[]) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export async function POST(req: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid assessment id.' }, { status: 400 })
  if (!(await enforceRateLimit(`attempt-start:${user.id}`))) return NextResponse.json({ error: 'Too many attempt-start requests. Try again shortly.' }, { status: 429 })

  try {
    const assessment = await getAccessibleAssessment(parsed.data.assessmentId, user.id)
    if (!assessment) return NextResponse.json({ error: 'Assessment not found or not available.' }, { status: 404 })

    const admin = createAdminClient()
    const questions = await getQuestionsForGrading(assessment.questionIds)
    if (questions.length !== assessment.questionIds.length || !questions.length) {
      return NextResponse.json({ error: 'Assessment contains unavailable or unpublished questions.' }, { status: 409 })
    }

    const { data: aq, error: aqError } = await admin
      .from('assessment_questions')
      .select('question_id,marks_override,time_limit_override_sec')
      .eq('assessment_id', assessment.id)
    if (aqError) throw aqError

    const overrides = new Map((aq ?? []).map(x => [x.question_id, x]))
    if (overrides.size !== questions.length) return NextResponse.json({ error: 'Assessment question configuration is incomplete.' }, { status: 409 })

    const configured = questions.map(q => {
      const x = overrides.get(q.id)
      return x ? { ...q, marks: x.marks_override ?? q.marks, timeLimitSec: x.time_limit_override_sec ?? q.timeLimitSec } : q
    })
    const order = assessment.randomizeQuestions ? shuffle(configured) : configured
    const maxScore = order.reduce((sum, q) => sum + q.marks, 0)

    const snapshots = order.map(q => {
      const choices = assessment.randomizeOptions && q.choices ? shuffle(q.choices) : q.choices
      return {
        questionId: q.id,
        questionVersion: q.version ?? 1,
        questionSnapshot: {
          id: q.id, programId: q.programId, topic: q.topic, subtopic: q.subtopic, title: q.title, prompt: q.prompt,
          questionType: q.questionType, difficulty: q.difficulty, marks: q.marks, timeLimitSec: q.timeLimitSec,
          instructions: q.instructions, datasetId: q.datasetId, starterCode: q.starterCode, choices, tags: q.tags,
          gradingMode: q.gradingMode, explanation: q.explanation,
        },
        answerKeySnapshot: q.answerKey == null ? null : String(q.answerKey),
        graderConfigSnapshot: q.graderConfig ?? {},
      }
    })

    const { data, error } = await admin.rpc('start_attempt_with_snapshots', {
      p_assessment_id: assessment.id,
      p_user_id: user.id,
      p_question_order: order.map(q => q.id),
      p_max_score: maxScore,
      p_snapshots: snapshots,
    })
    if (error) {
      if (String(error.message).includes('MAX_ATTEMPTS')) return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 409 })
      if (String(error.message).includes('ASSESSMENT_NOT_FOUND')) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 })
      throw error
    }

    const row = data?.[0]
    if (!row) throw new Error('No attempt returned from atomic start.')
    if (row.resumed) return NextResponse.json({ attemptId: row.attempt_id, startedAt: row.started_at, resumed: true })

    return NextResponse.json({ attemptId: row.attempt_id, startedAt: row.started_at, questionOrder: order.map(q => q.id) })
  } catch (err) {
    console.error('[attempts/start] failed', err)
    return NextResponse.json({ error: 'Could not start assessment. Please try again.' }, { status: 500 })
  }
}
