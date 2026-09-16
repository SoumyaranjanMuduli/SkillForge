import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'
import type { Assessment, GradingQuestion, Program, Question } from './types'
import type { Database } from './supabase/database.types'
import { getBuiltInPracticeQuestion, isBuiltInPracticeQuestion, listBuiltInPracticeQuestions } from './practice-bank'

const configured = () => Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

type QuestionRow = Partial<Database['public']['Tables']['questions']['Row']> & Pick<Database['public']['Tables']['questions']['Row'], 'id' | 'program_id' | 'topic' | 'title' | 'prompt' | 'question_type' | 'difficulty' | 'marks' | 'time_limit_sec'>
type AssessmentRow = Database['public']['Tables']['assessments']['Row'] & {
  assessment_questions?: Pick<Database['public']['Tables']['assessment_questions']['Row'], 'question_id' | 'position'>[] | null
}

function publicDataset(graderConfig: unknown): Record<string, Record<string, unknown>[]> | null {
  if (!graderConfig || typeof graderConfig !== 'object' || Array.isArray(graderConfig)) return null
  const value = (graderConfig as Record<string, unknown>).publicDataset
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const dataset = value as Record<string, unknown>
  if (Object.keys(dataset).length > 20) return null
  const safe: Record<string, Record<string, unknown>[]> = {}
  for (const [tableName, rows] of Object.entries(dataset)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(tableName)) return null
    if (!Array.isArray(rows) || rows.length > 500) return null
    const safeRows: Record<string, unknown>[] = []
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null
      const record = row as Record<string, unknown>
      if (Object.keys(record).length > 100) return null
      safeRows.push(record)
    }
    safe[tableName] = safeRows
  }
  return safe
}

function mapQuestion(q: QuestionRow): Question {
  return {
    id: q.id,
    programId: q.program_id,
    topic: q.topic,
    subtopic: q.subtopic,
    title: q.title,
    prompt: q.prompt,
    questionType: q.question_type,
    difficulty: q.difficulty,
    marks: q.marks,
    timeLimitSec: q.time_limit_sec,
    instructions: q.instructions,
    datasetId: q.dataset_id,
    starterCode: q.starter_code,
    choices: q.choices as string[] | null | undefined,
    tags: q.tags as string[] | null | undefined,
    gradingMode: q.grading_mode,
    explanation: q.explanation,
    version: q.version,
    practiceDataset: publicDataset(q.grader_config),
  }
}

function mapAssessment(a: AssessmentRow): Assessment {
  return {
    id: a.id,
    name: a.name,
    programId: a.program_id,
    durationSec: a.duration_sec,
    description: a.description,
    questionIds: (a.assessment_questions ?? []).slice().sort((x, y) => x.position - y.position).map(x => x.question_id),
    published: a.published,
    passingScore: a.passing_score,
    maxAttempts: a.max_attempts,
    randomizeQuestions: a.randomize_questions,
    randomizeOptions: a.randomize_options,
    startDate: a.start_date,
    endDate: a.end_date,
  }
}

export async function getPrograms(): Promise<Program[]> {
  if (!configured()) return []
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('programs').select('*').eq('status', 'active').order('name')
    if (error) throw error
    return data.map(p => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, notes: (p as any).notes ?? '', icon: p.icon, status: p.status === 'archived' ? 'archived' : 'active' }))
  } catch {
    console.error('[assessment] getPrograms failed')
    return []
  }
}

export async function getAssessment(id: string) {
  if (!configured() || !id) return null
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('assessments').select('*, assessment_questions(question_id,position)').eq('id', id).maybeSingle()
    if (error || !data) return null
    return mapAssessment(data)
  } catch {
    console.error('[assessment] getAssessment failed')
    return null
  }
}

export async function getAccessibleAssessment(id: string, userId: string) {
  const assessment = await getAssessment(id)
  if (!assessment || !configured()) return null
  const now = new Date().toISOString()
  if (assessment.startDate && assessment.startDate > now) return null
  if (assessment.endDate && assessment.endDate < now) return null
  if (assessment.published) return assessment

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('assessment_assignments').select('assessment_id').eq('assessment_id', id).eq('user_id', userId).maybeSingle()
    if (error || !data) return null
    return assessment
  } catch {
    console.error('[assessment] assignment lookup failed')
    return null
  }
}

export async function getAssessmentsForUser(userId: string) {
  if (!configured()) return []
  try {
    const admin = createAdminClient()
    const { data: assignments, error: assignmentError } = await admin.from('assessment_assignments').select('assessment_id').eq('user_id', userId)
    if (assignmentError) throw assignmentError
    const assignedIds = (assignments ?? []).map(a => a.assessment_id)
    const publishedQuery = admin.from('assessments').select('*, assessment_questions(question_id,position)').eq('published', true).order('created_at', { ascending: false }).limit(500)
    const assignedQuery = assignedIds.length
      ? admin.from('assessments').select('*, assessment_questions(question_id,position)').in('id', assignedIds).limit(500)
      : null
    const [publishedRes, assignedRes] = await Promise.all([publishedQuery, assignedQuery ?? Promise.resolve({ data: [], error: null } as any)])
    if (publishedRes.error) throw publishedRes.error
    if (assignedRes.error) throw assignedRes.error
    const unique = new Map<string, AssessmentRow>()
    for (const row of [...(publishedRes.data ?? []), ...(assignedRes.data ?? [])]) unique.set(row.id, row as AssessmentRow)
    const now = new Date().toISOString()
    return [...unique.values()].map(mapAssessment)
      .filter(a => a.published || assignedIds.includes(a.id))
      .filter(a => !a.startDate || a.startDate <= now)
      .filter(a => !a.endDate || a.endDate >= now)
  } catch {
    console.error('[assessment] getAssessmentsForUser failed')
    return []
  }
}

export async function getQuestions(ids: string[]): Promise<Question[]> {
  if (!ids.length || !configured()) return []
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('questions').select('id,program_id,topic,subtopic,title,prompt,question_type,difficulty,marks,time_limit_sec,instructions,dataset_id,starter_code,choices,tags,grading_mode,explanation,version,status,grader_config').in('id', ids).eq('status', 'published')
    if (error || !data) return []
    const byId = new Map(data.map(q => [q.id, mapQuestion(q)]))
    return ids.map(id => byId.get(id)).filter(Boolean) as Question[]
  } catch {
    console.error('[assessment] getQuestions failed')
    return []
  }
}

export async function getQuestionsForGrading(ids: string[]): Promise<GradingQuestion[]> {
  if (!ids.length || !configured()) return []
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('questions').select('*').in('id', ids).eq('status', 'published')
    if (error || !data) return []
    const byId = new Map(data.map(q => [q.id, { ...mapQuestion(q), answerKey: q.answer_key, graderConfig: q.grader_config as Record<string, unknown> | null | undefined }]))
    return ids.map(id => byId.get(id)).filter(Boolean) as GradingQuestion[]
  } catch {
    console.error('[assessment] getQuestionsForGrading failed')
    return []
  }
}

export async function getQuestion(id: string): Promise<Question | null> {
  const builtIn = getBuiltInPracticeQuestion(id)
  if (builtIn) return builtIn
  const [q] = await getQuestions([id])
  return q ?? null
}

export async function listPracticeQuestions(): Promise<Question[]> {
  const builtIn = listBuiltInPracticeQuestions()
  if (!configured()) return builtIn

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('questions').select('id,program_id,topic,subtopic,title,prompt,question_type,difficulty,marks,time_limit_sec,instructions,dataset_id,starter_code,choices,tags,grading_mode,explanation,version,status,grader_config').eq('status', 'published').order('created_at', { ascending: false }).limit(1000)
    if (error || !data) return builtIn

    const dbQuestions = data.map(mapQuestion)
    const seen = new Set(builtIn.map(q => q.id))
    return [...builtIn, ...dbQuestions.filter(q => !seen.has(q.id))]
  } catch {
    console.error('[assessment] listPracticeQuestions failed')
    return builtIn
  }
}

export async function getAttemptRank(attemptId: string, assessmentId: string) {
  if (!configured() || !attemptId || !assessmentId) return null

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('attempts')
      .select('id,score')
      .eq('assessment_id', assessmentId)
      .eq('status', 'released')
      .not('score', 'is', null)
      .order('score', { ascending: false })
      .limit(5000)

    if (error) throw error

    const rows = data ?? []
    const position = rows.findIndex(row => row.id === attemptId)
    if (position < 0) return null

    const score = Number(rows[position].score ?? 0)
    const higher = rows.filter(row => Number(row.score ?? 0) > score).length
    return { position: higher + 1, total: rows.length }
  } catch {
    console.error('[assessment] getAttemptRank failed')
    return null
  }
}

export async function getQuestionSuccessRates(ids: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = Object.fromEntries(ids.map(id => [id, null]))
  if (!configured() || !ids.length) return out
  try {
    const dbIds = ids.filter(id => !isBuiltInPracticeQuestion(id))
    if (!dbIds.length) return out
    const admin = createAdminClient()
    const { data, error } = await admin.from('attempt_answers').select('question_id,is_correct').in('question_id', dbIds).not('is_correct', 'is', null).limit(100_000)
    if (error) throw error
    const tally = new Map<string, { n: number; correct: number }>()
    for (const row of data ?? []) {
      const t = tally.get(row.question_id) ?? { n: 0, correct: 0 }
      t.n++
      if (row.is_correct) t.correct++
      tally.set(row.question_id, t)
    }
    for (const [id, t] of tally) out[id] = t.n ? Math.round((t.correct / t.n) * 100) : null
  } catch {
    console.error('[assessment] getQuestionSuccessRates failed')
  }
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
  const empty = { totalAssessments: 0, completed: 0, avgScore: 0, perProgram: programs.map(p => ({ programId: p.id, name: p.name, pct: 0 })), activityDates: [] }
  if (!configured()) return empty

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('attempts').select('score,max_score,submitted_at,result_released_at,assessments(program_id)').eq('user_id', userId).not('result_released_at', 'is', null).limit(5000)
    if (error) throw error
    const rows = (data ?? []) as { score: number | null; max_score: number | null; submitted_at: string | null; result_released_at: string | null; assessments: { program_id: string } | { program_id: string }[] | null }[]
    const completedRows = rows.filter(r => r.submitted_at)
    const scored = completedRows.filter(r => Number(r.max_score) > 0)
    const pct = (r: typeof scored[number]) => Number(r.score) / Number(r.max_score) * 100
    const avgScore = scored.length ? Math.round(scored.reduce((n, r) => n + pct(r), 0) / scored.length) : 0
    const byProgram = new Map<string, { n: number; pct: number }>()
    for (const r of scored) {
      const a = Array.isArray(r.assessments) ? r.assessments[0] : r.assessments
      const pid = a?.program_id
      if (!pid) continue
      const cur = byProgram.get(pid) ?? { n: 0, pct: 0 }
      cur.n++
      cur.pct += pct(r)
      byProgram.set(pid, cur)
    }
    const perProgram = programs.map(p => {
      const agg = byProgram.get(p.id)
      return { programId: p.id, name: p.name, pct: agg ? Math.round(agg.pct / agg.n) : 0 }
    })
    return { totalAssessments: rows.length, completed: completedRows.length, avgScore, perProgram, activityDates: completedRows.map(r => r.submitted_at!.slice(0, 10)) }
  } catch {
    console.error('[assessment] getUserProgressSummary failed')
    return empty
  }
}

export async function getUserAttempts(userId: string) {
  if (!configured()) return []
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('attempts').select('id,assessment_id,score,max_score,status,submitted_at,started_at,result_released_at,assessments(name,program_id)').eq('user_id', userId).order('started_at', { ascending: false }).limit(200)
    if (error) throw error
    return data ?? []
  } catch {
    console.error('[assessment] getUserAttempts failed')
    return []
  }
}

export async function getServerUser() {
  if (!configured()) return null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).maybeSingle()
    if (profile?.status === 'disabled') return null
    return user
  } catch {
    console.error('[assessment] getServerUser failed')
    return null
  }
}
