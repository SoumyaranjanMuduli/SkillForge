import { createAdminClient } from './supabase/admin'
import { requireAdmin } from './auth'

export type AdminAttemptAnswer = {
  id: string
  question_id: string
  answer: string
  is_correct: boolean | null
  score: number
  time_spent_sec: number
  feedback: string | null
  admin_comment: string | null
  reviewed: boolean
}

export type AdminAttempt = {
  id: string
  assessment_id: string
  user_id: string
  started_at: string
  submitted_at: string | null
  duration_sec: number
  score: number
  max_score: number
  status: string
  result_released_at: string | null
  assessments: { name: string } | null
  profiles: { full_name: string } | null
  attempt_answers: AdminAttemptAnswer[]
}

export async function getAdminAttempt(attemptId: string): Promise<AdminAttempt | null> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin.from('attempts').select('id,assessment_id,user_id,started_at,submitted_at,duration_sec,score,max_score,status,result_released_at,assessments(name),profiles(full_name),attempt_answers(id,question_id,answer,is_correct,score,time_spent_sec,feedback,admin_comment,reviewed)').eq('id', attemptId).maybeSingle()
  return data as AdminAttempt | null
}
