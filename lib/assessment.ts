import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'
import type { Assessment, GradingQuestion, Program, Question } from './types'
import type { Database } from './supabase/database.types'

const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)

type QuestionRow = Partial<Database['public']['Tables']['questions']['Row']> & Pick<Database['public']['Tables']['questions']['Row'], 'id' | 'program_id' | 'topic' | 'title' | 'prompt' | 'question_type' | 'difficulty' | 'marks' | 'time_limit_sec'>
type AssessmentRow = Database['public']['Tables']['assessments']['Row'] & {
  assessment_questions?: Pick<Database['public']['Tables']['assessment_questions']['Row'], 'question_id' | 'position'>[] | null
}

// Pulls ONLY the `dataset` key out of a question's grader_config for client exposure. This is
// the input data a SQL/code question runs against — not secret, students need to see it to
// write a correct query — as opposed to `expected`/`tests`/`tolerance`/answer-adjacent keys,
// which must never reach the client. Never spread the raw grader_config object here.
function publicDataset(graderConfig: unknown): Record<string, Record<string, unknown>[]> | null {
  if (!graderConfig || typeof graderConfig !== 'object' || Array.isArray(graderConfig)) return null
  const dataset = (graderConfig as Record<string, unknown>).dataset
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return null
  return dataset as Record<string, Record<string, unknown>[]>
}

function mapQuestion(q: QuestionRow): Question {
  return {
    id: q.id, programId: q.program_id, topic: q.topic, subtopic: q.subtopic, title: q.title, prompt: q.prompt,
    questionType: q.question_type, difficulty: q.difficulty, marks: q.marks, timeLimitSec: q.time_limit_sec,
    instructions: q.instructions, datasetId: q.dataset_id, starterCode: q.starter_code, choices: q.choices as string[] | null | undefined,
    tags: q.tags as string[] | null | undefined, gradingMode: q.grading_mode, explanation: q.explanation, version: q.version,
    practiceDataset: publicDataset((q as Partial<Database['public']['Tables']['questions']['Row']>).grader_config),
  }
}

function mapAssessment(a: AssessmentRow): Assessment {
  return {
    id: a.id, name: a.name, programId: a.program_id, durationSec: a.duration_sec, description: a.description,
    questionIds: (a.assessment_questions ?? []).slice().sort((x, y) => x.position - y.position).map((x) => x.question_id),
    published: a.published, passingScore: a.passing_score, maxAttempts: a.max_attempts,
    randomizeQuestions: a.randomize_questions, randomizeOptions: a.randomize_options,
    startDate: a.start_date, endDate: a.end_date,
  }
}

export async function getPrograms(): Promise<Program[]> {
  if (!configured()) return []
  const admin = createAdminClient()
  const { data, error } = await admin.from('programs').select('*').eq('status', 'active').order('name')
  if (error) return []
  return data.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, description: p.description, icon: p.icon,
    status: p.status === 'archived' ? 'archived' : 'active',
  }))
}

export async function getAssessment(id: string) {
  if (!configured()) return null
  const admin = createAdminClient()
  const { data } = await admin.from('assessments').select('*, assessment_questions(question_id,position)').eq('id', id).maybeSingle()
  return data ? mapAssessment(data) : null
}

export async function getAccessibleAssessment(id: string, userId: string) {
  const assessment = await getAssessment(id)
  if (!assessment) return null
  if (!configured()) return null
  const admin = createAdminClient()
  const now = new Date().toISOString()
  if (assessment.startDate && assessment.startDate > now) return null
  if (assessment.endDate && assessment.endDate < now) return null
  if (assessment.published) return assessment
  const { data } = await admin.from('assessment_assignments').select('assessment_id').eq('assessment_id', id).eq('user_id', userId).maybeSingle()
  return data ? assessment : null
}

export async function getAssessmentsForUser(userId: string) {
  if (!configured()) return []
  const admin = createAdminClient()
  const [{ data: all, error }, { data: assignments }] = await Promise.all([
    admin.from('assessments').select('*, assessment_questions(question_id,position)').order('created_at', { ascending: false }),
    admin.from('assessment_assignments').select('assessment_id').eq('user_id', userId),
  ])
  if (error) return []
  const assignedIds = new Set((assignments ?? []).map((a) => a.assessment_id))
  const now = new Date().toISOString()
  return (all ?? [])
    .map(mapAssessment)
    .filter((a) => a.published || assignedIds.has(a.id))
    .filter((a) => !a.startDate || a.startDate <= now)
    .filter((a) => !a.endDate || a.endDate >= now)
}

export async function getQuestions(ids: string[]): Promise<Question[]> {
  if (!ids.length) return []
  if (!configured()) return []
  const admin = createAdminClient()
  const { data, error } = await admin.from('questions').select('id,program_id,topic,subtopic,title,prompt,question_type,difficulty,marks,time_limit_sec,instructions,dataset_id,starter_code,choices,tags,grading_mode,explanation,version,status,grader_config').in('id', ids).eq('status', 'published')
  if (error || !data) return []
  const byId = new Map(data.map((q) => [q.id, mapQuestion(q)]))
  return ids.map((id) => byId.get(id)).filter(Boolean) as Question[]
}

export async function getQuestionsForGrading(ids: string[]): Promise<GradingQuestion[]> {
  if (!configured()) return []
  const admin = createAdminClient()
  const { data, error } = await admin.from('questions').select('*').in('id', ids)
  if (error || !data) return []
  const byId = new Map(data.map((q) => [q.id, {
    ...mapQuestion(q), answerKey: q.answer_key, graderConfig: q.grader_config as Record<string, unknown> | null | undefined,
  }]))
  return ids.map((id) => byId.get(id)).filter(Boolean) as GradingQuestion[]
}

export async function getQuestion(id: string): Promise<Question | null> {
  const [q] = await getQuestions([id])
  return q ?? null
}

export async function listPracticeQuestions(): Promise<Question[]> {
  if (!configured()) return []
  const admin = createAdminClient()
  const { data, error } = await admin.from('questions').select('id,program_id,topic,subtopic,title,prompt,question_type,difficulty,marks,time_limit_sec,instructions,dataset_id,starter_code,choices,tags,grading_mode,explanation,version,status,grader_config').eq('status', 'published').order('created_at', { ascending: false }).limit(300)
  if (error || !data) return []
  return data.map(mapQuestion)
}

// Best-effort public success rate per question, computed from real attempt_answers.
// Returns null for a question with no graded attempts yet rather than a made-up number.
export async function getQuestionSuccessRates(ids: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = Object.fromEntries(ids.map((id) => [id, null]))
  if (!configured() || !ids.length) return out
  const admin = createAdminClient()
  const { data } = await admin.from('attempt_answers').select('question_id,is_correct').in('question_id', ids).not('is_correct', 'is', null)
  const tally = new Map<string, { n: number; correct: number }>()
  for (const row of data ?? []) {
    const t = tally.get(row.question_id) ?? { n: 0, correct: 0 }
    t.n++
    if (row.is_correct) t.correct++
    tally.set(row.question_id, t)
  }
  for (const [id, t] of tally) out[id] = Math.round((t.correct / t.n) * 100)
  return out
}

export type ProgressSummary = {
  totalAssessments: number
  completed: number
  avgScore: number
  perProgram: { programId: string; name: string; pct: number }[]
  activityDates: string[]
}

export async function getUserProgressSummary(userId: string): Promise<ProgressSummary> {
  const programs = await getPrograms()
  if (!configured()) return { totalAssessments: 0, completed: 0, avgScore: 0, perProgram: programs.map((p) => ({ programId: p.id, name: p.name, pct: 0 })), activityDates: [] }
  const admin = createAdminClient()
  const { data } = await admin
    .from('attempts')
    .select('score,max_score,submitted_at,assessments(program_id)')
    .eq('user_id', userId)
  const rows = (data ?? []) as { score: number | null; max_score: number | null; submitted_at: string | null; assessments: { program_id: string } | { program_id: string }[] | null }[]
  const completedRows = rows.filter((r) => r.submitted_at)
  const scored = completedRows.filter((r) => r.max_score)
  const avgScore = scored.length ? Math.round(scored.reduce((n, r) => n + Number(r.score) / Number(r.max_score) * 100, 0) / scored.length) : 0
  const byProgram = new Map<string, { n: number; pct: number }>()
  for (const r of scored) {
    const a = Array.isArray(r.assessments) ? r.assessments[0] : r.assessments
    const pid = a?.program_id
    if (!pid) continue
    const cur = byProgram.get(pid) ?? { n: 0, pct: 0 }
    cur.n++
    cur.pct += Number(r.score) / Number(r.max_score) * 100
    byProgram.set(pid, cur)
  }
  const perProgram = programs.map((p) => {
    const agg = byProgram.get(p.id)
    return { programId: p.id, name: p.name, pct: agg ? Math.round(agg.pct / agg.n) : 0 }
  })
  const activityDates = completedRows.map((r) => (r.submitted_at as string).slice(0, 10))
  return { totalAssessments: rows.length, completed: completedRows.length, avgScore, perProgram, activityDates }
}

export async function getUserAttempts(userId: string) {
  if (!configured()) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('attempts')
    .select('id,assessment_id,score,max_score,status,submitted_at,started_at,result_released_at,assessments(name,program_id)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(100)
  return data ?? []
}

export async function getServerUser() {
  if (!configured()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient() as any
  const { data: profile } = await admin.from('profiles').select('status').eq('id', user.id).maybeSingle()
  if (profile?.status === 'disabled') return null
  return user
}
