import * as XLSX from 'xlsx'
import { z } from 'zod'
import type { QuestionType, Difficulty } from './types'

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------
// Source spreadsheet header (see templates/question-import-template.csv) ->
// internal field name. Header matching is case-insensitive and ignores
// spaces/underscores so "Question Type", "question_type" and "QuestionType"
// all resolve to the same field.
const COLUMN_MAP: Record<string, string> = {
  questionid: 'id',
  program: 'programId',
  topic: 'topic',
  subtopic: 'subtopic',
  title: 'title',
  question: 'prompt',
  prompt: 'prompt',
  questiontype: 'questionType',
  difficulty: 'difficulty',
  marks: 'marks',
  timelimitsec: 'timeLimitSec',
  timelimit: 'timeLimitSec',
  instructions: 'instructions',
  choices: 'choices',
  correctanswer: 'correctAnswer',
  answerkey: 'answerKey',
  gradingmode: 'gradingMode',
  startercode: 'starterCode',
  graderconfig: 'graderConfig',
  explanation: 'explanation',
  tags: 'tags',
  status: 'status',
}

const QUESTION_TYPES: QuestionType[] = ['mcq', 'multi_select', 'true_false', 'text', 'numeric', 'sql', 'python', 'excel', 'code', 'data_engineering', 'case_study', 'manual_review']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const IMPORT_STATUSES = ['draft', 'in_review', 'published'] as const

export type ImportRowStatus = (typeof IMPORT_STATUSES)[number]

export const MAX_IMPORT_ROWS = 2000

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function splitList(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) return value.map(String)
  return String(value).split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
}

/** Row shape after header mapping, before validation — everything is a loose string/number/unknown. */
type RawImportRow = Record<string, unknown>

/** A row that passed validation and is ready to upsert into `questions`. */
export const ImportedQuestionSchema = z.object({
  id: z.string().trim().min(2).max(120),
  programId: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(200),
  subtopic: z.string().trim().max(200).optional(),
  title: z.string().trim().min(1).max(500),
  prompt: z.string().trim().min(1).max(50_000),
  questionType: z.enum(QUESTION_TYPES as [QuestionType, ...QuestionType[]]),
  difficulty: z.enum(DIFFICULTIES as [Difficulty, ...Difficulty[]]),
  marks: z.number().int().positive().max(1000),
  timeLimitSec: z.number().int().positive().max(86_400),
  instructions: z.string().max(20_000).optional(),
  choices: z.array(z.string().max(1000)).max(100).optional(),
  answerKey: z.string().trim().min(1).max(100_000),
  gradingMode: z.string().max(80).optional(),
  starterCode: z.string().max(100_000).optional(),
  graderConfig: z.record(z.unknown()).optional(),
  explanation: z.string().max(20_000).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  status: z.enum(IMPORT_STATUSES).optional(),
})

export type ImportedQuestion = z.infer<typeof ImportedQuestionSchema>

export type ImportRowResult =
  | { row: number; ok: true; data: ImportedQuestion; warnings: string[] }
  | { row: number; ok: false; errors: string[]; raw: RawImportRow }

export type ImportParseResult = {
  rows: ImportRowResult[]
  validCount: number
  errorCount: number
  duplicateIds: string[]
}

/** Parses an uploaded .xlsx/.xls/.csv file buffer into mapped, header-normalized rows. */
function parseWorkbook(buffer: ArrayBuffer): RawImportRow[] {
  const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true })

  return json.map((rawRow) => {
    const mapped: RawImportRow = {}
    for (const [header, value] of Object.entries(rawRow)) {
      const key = COLUMN_MAP[normalizeHeader(header)]
      if (key) mapped[key] = value
    }
    return mapped
  })
}

function coerceNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  return Number.isFinite(n) ? n : NaN
}

function coerceRow(raw: RawImportRow, knownProgramIds: Set<string>): { data?: ImportedQuestion; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  const marks = coerceNumber(raw.marks)
  if (marks === undefined) errors.push('marks is required')
  else if (Number.isNaN(marks)) errors.push(`marks "${raw.marks}" is not a number`)

  const timeLimitSec = coerceNumber(raw.timeLimitSec)
  if (timeLimitSec === undefined) errors.push('timeLimitSec is required')
  else if (Number.isNaN(timeLimitSec)) errors.push(`timeLimitSec "${raw.timeLimitSec}" is not a number`)

  const programIdRaw = String(raw.programId ?? '').trim()
  let programId = programIdRaw
  if (!programIdRaw) {
    errors.push('program is required')
  } else if (!knownProgramIds.has(programIdRaw.toLowerCase())) {
    errors.push(`program "${programIdRaw}" does not match any existing program id/slug`)
  } else {
    programId = programIdRaw.toLowerCase()
  }

  const questionType = String(raw.questionType ?? '').trim().toLowerCase()
  if (!QUESTION_TYPES.includes(questionType as QuestionType)) {
    errors.push(`questionType "${raw.questionType ?? ''}" must be one of: ${QUESTION_TYPES.join(', ')}`)
  }

  const difficulty = String(raw.difficulty ?? '').trim().toLowerCase()
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) {
    errors.push(`difficulty "${raw.difficulty ?? ''}" must be one of: ${DIFFICULTIES.join(', ')}`)
  }

  let graderConfig: Record<string, unknown> | undefined
  if (raw.graderConfig !== undefined && raw.graderConfig !== '') {
    try {
      graderConfig = typeof raw.graderConfig === 'string' ? JSON.parse(raw.graderConfig) : (raw.graderConfig as Record<string, unknown>)
    } catch {
      errors.push('graderConfig is not valid JSON')
    }
  }

  const answerKey = String(raw.answerKey ?? raw.correctAnswer ?? '').trim()
  if (!answerKey) errors.push('answerKey (or correct_answer) is required')

  const choices = splitList(raw.choices)
  if ((questionType === 'mcq' || questionType === 'multi_select') && (!choices || choices.length < 2)) {
    warnings.push('mcq/multi_select questions usually need 2+ choices')
  }

  let status: ImportRowStatus | undefined
  if (raw.status) {
    const s = String(raw.status).trim().toLowerCase()
    if ((IMPORT_STATUSES as readonly string[]).includes(s)) status = s as ImportRowStatus
    else warnings.push(`status "${raw.status}" is not recognized and will fall back to the batch default`)
  }

  if (errors.length) return { errors, warnings }

  const candidate: ImportedQuestion = {
    id: String(raw.id ?? '').trim(),
    programId,
    topic: String(raw.topic ?? '').trim(),
    subtopic: raw.subtopic ? String(raw.subtopic).trim() : undefined,
    title: String(raw.title ?? '').trim(),
    prompt: String(raw.prompt ?? '').trim(),
    questionType: questionType as QuestionType,
    difficulty: difficulty as Difficulty,
    marks: marks as number,
    timeLimitSec: timeLimitSec as number,
    instructions: raw.instructions ? String(raw.instructions) : undefined,
    choices,
    answerKey,
    gradingMode: raw.gradingMode ? String(raw.gradingMode).trim() : undefined,
    starterCode: raw.starterCode ? String(raw.starterCode) : undefined,
    graderConfig,
    explanation: raw.explanation ? String(raw.explanation) : undefined,
    tags: splitList(raw.tags),
    status,
  }

  const parsed = ImportedQuestionSchema.safeParse(candidate)
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`), warnings }
  }
  return { data: parsed.data, errors: [], warnings }
}

/**
 * Parses and validates an uploaded workbook against the question schema.
 * Pure function, no DB writes — used for the import preview step.
 */
export function parseImportFile(buffer: ArrayBuffer, knownProgramIds: string[]): ImportParseResult {
  const rawRows = parseWorkbook(buffer)
  if (rawRows.length > MAX_IMPORT_ROWS) throw new Error(`Import contains ${rawRows.length} rows; the maximum is ${MAX_IMPORT_ROWS}.`)

  const programIdSet = new Set(knownProgramIds.map((p) => p.toLowerCase()))
  const seenIds = new Set<string>()
  const duplicateIds = new Set<string>()

  const rows: ImportRowResult[] = rawRows.map((raw, i) => {
    const rowNumber = i + 2 // +1 for 0-index, +1 for header row
    const { data, errors, warnings } = coerceRow(raw, programIdSet)
    if (data) {
      if (seenIds.has(data.id)) {
        duplicateIds.add(data.id)
        return { row: rowNumber, ok: false, errors: [`Duplicate question id "${data.id}" in this import.`], raw }
      }
      seenIds.add(data.id)
      return { row: rowNumber, ok: true, data, warnings }
    }
    return { row: rowNumber, ok: false, errors, raw }
  })

  return {
    rows,
    validCount: rows.filter((r) => r.ok).length,
    errorCount: rows.filter((r) => !r.ok).length,
    duplicateIds: [...duplicateIds],
  }
}

/** Parses pasted TSV/CSV/Excel-style text. Server-side only so the same validation rules apply as file import. */
export function parseImportText(text: string, knownProgramIds: string[]): ImportParseResult {
  // XLSX detects both TSV and CSV separators from pasted spreadsheet text.
  const workbook = XLSX.read(text, { type: 'string', raw: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { rows: [], validCount: 0, errorCount: 0, duplicateIds: [] }
  const sheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true })
  const rawRows = json.map((rawRow) => {
    const mapped: RawImportRow = {}
    for (const [header, value] of Object.entries(rawRow)) {
      const key = COLUMN_MAP[normalizeHeader(header)]
      if (key) mapped[key] = value
    }
    return mapped
  })

  if (rawRows.length > MAX_IMPORT_ROWS) throw new Error(`Import contains ${rawRows.length} rows; the maximum is ${MAX_IMPORT_ROWS}.`)

  const programIdSet = new Set(knownProgramIds.map((p) => p.toLowerCase()))
  const seenIds = new Set<string>()
  const duplicateIds = new Set<string>()
  const rows: ImportRowResult[] = rawRows.map((raw, i) => {
    const rowNumber = i + 2
    const { data, errors, warnings } = coerceRow(raw, programIdSet)
    if (data) {
      if (seenIds.has(data.id)) {
        duplicateIds.add(data.id)
        return { row: rowNumber, ok: false, errors: [`Duplicate question id "${data.id}" in this import.`], raw }
      }
      seenIds.add(data.id)
      return { row: rowNumber, ok: true, data, warnings }
    }
    return { row: rowNumber, ok: false, errors, raw }
  })

  return {
    rows,
    validCount: rows.filter((r) => r.ok).length,
    errorCount: rows.filter((r) => !r.ok).length,
    duplicateIds: [...duplicateIds],
  }
}
