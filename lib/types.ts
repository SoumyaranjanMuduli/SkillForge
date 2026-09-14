export type Role = 'user' | 'admin'
export type QuestionType = 'mcq' | 'multi_select' | 'true_false' | 'text' | 'numeric' | 'sql' | 'python' | 'excel' | 'code' | 'data_engineering' | 'case_study' | 'manual_review'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type AttemptStatus = 'in_progress' | 'submitted' | 'auto_graded' | 'under_review' | 'approved' | 'released'

export type Program = {
  id: string
  slug: string
  name: string
  description: string
  icon?: string
  status?: 'active' | 'archived'
}

export type Question = {
  id: string
  programId: string
  topic: string
  subtopic?: string | null
  title: string
  prompt: string
  questionType: QuestionType
  difficulty: Difficulty
  marks: number
  timeLimitSec: number
  instructions?: string | null
  datasetId?: string | null
  starterCode?: string | null
  choices?: string[] | null
  tags?: string[] | null
  gradingMode?: string | null
  explanation?: string | null
  version?: number
  // Safe, public subset of graderConfig.dataset (input tables only — never the expected
  // output/tests). Lets the in-browser SQL preview query the question's real dataset instead
  // of a hardcoded demo table. Absent for questions that don't define a custom dataset.
  practiceDataset?: Record<string, Record<string, unknown>[]> | null
  // Present only on server-side/grading copies of a question — never sent to user-facing APIs.
  answerKey?: string | null
  graderConfig?: Record<string, unknown> | null
}

export type GradingQuestion = Question & {
  answerKey: unknown
  graderConfig?: Record<string, unknown> | null
}

export type Assessment = {
  id: string
  name: string
  programId: string
  durationSec: number
  description: string
  questionIds: string[]
  published: boolean
  passingScore?: number
  maxAttempts?: number
  randomizeQuestions?: boolean
  randomizeOptions?: boolean
  startDate?: string | null
  endDate?: string | null
}
