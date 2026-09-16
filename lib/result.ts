import { createAdminClient } from './supabase/admin'
import { getServerUser } from './assessment'

export async function getAttempt(attemptId: string) {
  const user = await getServerUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: attempt } = await admin.from('attempts').select('id,assessment_id,user_id,started_at,submitted_at,duration_sec,score,max_score,status,result_released_at').eq('id', attemptId).eq('user_id', user.id).maybeSingle()
  if (!attempt) return null
  const { data: assessment } = await admin.from('assessments').select('id,name,program_id').eq('id', attempt.assessment_id).maybeSingle()
  const { data: answers } = await admin.from('attempt_answers').select('question_id,answer,is_correct,score,time_spent_sec,admin_comment,feedback').eq('attempt_id', attemptId)
  const { data: snapshots } = await admin.from('attempt_question_snapshots').select('question_id,question_snapshot').eq('attempt_id', attemptId)
  const byQuestion = new Map((snapshots ?? []).map((s: any) => [s.question_id, s.question_snapshot]))
  const releasedAnswers = (answers ?? []).map((a: any) => {
    const q = byQuestion.get(a.question_id) as Record<string, any> | undefined
    return { ...a, title: q?.title, prompt: q?.prompt, marks: q?.marks }
  })
  // Never return answer keys/grader config to a user. Question text is safe after release.
  return { ...attempt, assessments: assessment, attempt_answers: attempt.result_released_at ? releasedAnswers : (answers ?? []).map((a) => ({ question_id: a.question_id, time_spent_sec: a.time_spent_sec })) }
}
