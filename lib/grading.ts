import { HyperFormula } from 'hyperformula'
import type { GradingQuestion } from './types'
import { runIsolated } from './execution'

export type GradeResult = {
  isCorrect: boolean | null
  score: number
  feedback: string
  requiresReview?: boolean
  gradingStatus?: 'completed' | 'failed' | 'manual_review'
}

const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase()
const MAX_ANSWER_LENGTH = 200_000
const MAX_MARKS = 10_000

const ALWAYS_MANUAL_REVIEW_TYPES = new Set(['manual_review', 'case_study', 'data_engineering'])

export function requiresManualReview(question: Pick<GradingQuestion, 'questionType' | 'gradingMode' | 'graderConfig'>) {
  return ALWAYS_MANUAL_REVIEW_TYPES.has(question.questionType) ||
    String(question.graderConfig?.mode ?? question.gradingMode ?? '').toLowerCase() === 'manual'
}

function cleanScore(value: number, marks: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(marks, Math.round(value * 100) / 100))
}

function scoreTests(q: GradingQuestion, result: unknown, label: string): GradeResult {
  const passed = typeof (result as any)?.passed === 'number' ? Number((result as any).passed) : 0
  const total = typeof (result as any)?.total === 'number' ? Number((result as any).total) : 0

  if (!Number.isInteger(passed) || !Number.isInteger(total) || total <= 0 || passed < 0 || passed > total) {
    return { isCorrect: null, score: 0, feedback: `${label} grading is not configured correctly; submitted for review.`, requiresReview: true, gradingStatus: 'manual_review' }
  }

  const score = cleanScore(q.marks * passed / total, q.marks)
  return {
    isCorrect: passed === total,
    score,
    feedback: passed === total ? `All ${label} tests passed.` : `${passed}/${total} ${label} tests passed.`,
    gradingStatus: 'completed',
  }
}

function gradeExcel(q: GradingQuestion, answer: string): GradeResult {
  const cfg = q.graderConfig ?? {}
  if (answer.length > MAX_ANSWER_LENGTH) return { isCorrect: null, score: 0, feedback: 'Excel submission is too large.', requiresReview: true, gradingStatus: 'manual_review' }

  let submission: any
  try { submission = JSON.parse(answer) } catch { return { isCorrect: null, score: 0, feedback: 'Excel submission must be workbook JSON.', requiresReview: true, gradingStatus: 'manual_review' } }

  const sheets = submission?.sheets ?? cfg.sheets
  const expected = cfg.expected
  if (!sheets || typeof sheets !== 'object' || Array.isArray(sheets) || !expected || typeof expected !== 'object' || Array.isArray(expected)) {
    return { isCorrect: null, score: 0, feedback: 'Excel grading configuration is incomplete; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
  }

  try {
    const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3' })
    const checks = Object.entries(expected as Record<string, any>)
    if (!checks.length) return { isCorrect: null, score: 0, feedback: 'Excel assessment has no expected cells.', requiresReview: true, gradingStatus: 'manual_review' }

    let passed = 0
    for (const [ref, rule] of checks) {
      const [sheetName, cell] = ref.includes('!') ? ref.split('!') : [Object.keys(sheets)[0] ?? 'Sheet1', ref]
      const sheetId = hf.getSheetId(sheetName)
      if (sheetId === undefined) continue
      const match = String(cell).match(/^([A-Z]+)(\d+)$/i)
      if (!match) continue
      let col = 0
      for (const ch of match[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64
      col--
      const row = Number(match[2]) - 1
      if (row < 0 || col < 0) continue
      const value = hf.getCellValue({ sheet: sheetId, row, col })
      const expectedValue = rule?.value ?? rule?.calculatedValue
      const formula = hf.getCellFormula({ sheet: sheetId, row, col })
      const valueOk = expectedValue === undefined || norm(String(value ?? '')) === norm(String(expectedValue))
      const formulaOk = !rule?.formula || norm(String(formula ?? '')) === norm(String(rule.formula))
      if (valueOk && formulaOk) passed++
    }

    const score = cleanScore(q.marks * passed / checks.length, q.marks)
    return {
      isCorrect: passed === checks.length,
      score,
      feedback: passed === checks.length ? 'All Excel checks passed.' : `${passed}/${checks.length} Excel checks passed.`,
      gradingStatus: 'completed',
    }
  } catch {
    console.error('[grading] Excel evaluation failed')
    return { isCorrect: null, score: 0, feedback: 'Excel evaluation failed; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
  }
}

function validateMarks(marks: unknown) {
  const value = Number(marks)
  return Number.isFinite(value) && value > 0 && value <= MAX_MARKS ? value : 0
}

function validateTimeout(value: unknown, fallback = 10_000) {
  const n = Number(value ?? fallback)
  return Number.isFinite(n) ? Math.max(250, Math.min(30_000, Math.trunc(n))) : fallback
}

export async function gradeAnswer(question: GradingQuestion, answer: string): Promise<GradeResult> {
  const marks = validateMarks(question.marks)
  if (!marks) return { isCorrect: null, score: 0, feedback: 'Question grading configuration is invalid.', requiresReview: true, gradingStatus: 'manual_review' }
  if (typeof answer !== 'string' || answer.length > MAX_ANSWER_LENGTH) return { isCorrect: null, score: 0, feedback: 'Submitted answer is invalid or too large.', requiresReview: true, gradingStatus: 'manual_review' }
  if (requiresManualReview(question)) return { isCorrect: null, score: 0, feedback: 'Submitted for admin review.', requiresReview: true, gradingStatus: 'manual_review' }

  const mode = String(question.graderConfig?.mode ?? question.gradingMode ?? '').toLowerCase()

  if (question.questionType === 'numeric' || mode === 'numeric') {
    const expected = Number(question.answerKey)
    const actual = Number(answer)
    const rawTolerance = Number(question.graderConfig?.tolerance ?? 1e-9)
    if (!Number.isFinite(expected) || !Number.isFinite(actual) || !Number.isFinite(rawTolerance) || rawTolerance < 0 || rawTolerance > 1_000_000) {
      return { isCorrect: null, score: 0, feedback: 'Numeric grading configuration is invalid; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    }
    const ok = Math.abs(expected - actual) <= rawTolerance
    return { isCorrect: ok, score: ok ? marks : 0, feedback: ok ? 'Correct.' : 'Incorrect numeric answer.', gradingStatus: 'completed' }
  }

  if (question.questionType === 'multi_select') {
    const expected = new Set(String(question.answerKey ?? '').split(',').map(norm).filter(Boolean))
    const actual = new Set(answer.split(',').map(norm).filter(Boolean))
    if (!expected.size) return { isCorrect: null, score: 0, feedback: 'Multi-select grading configuration is invalid; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    const partial = Boolean(question.graderConfig?.partial)
    const hits = [...actual].filter(x => expected.has(x)).length
    const wrong = [...actual].filter(x => !expected.has(x)).length
    const ok = expected.size === actual.size && hits === expected.size
    const ratio = Math.max(0, (hits - wrong) / expected.size)
    return { isCorrect: ok, score: ok ? marks : partial ? cleanScore(marks * ratio, marks) : 0, feedback: ok ? 'Correct.' : partial ? `Partial credit: ${hits}/${expected.size} correct selections.` : 'Incorrect selection.', gradingStatus: 'completed' }
  }

  if (question.questionType === 'sql' || question.questionType === 'python') {
    const cfg = question.graderConfig ?? {}
    const tests = cfg.tests
    if (!Array.isArray(tests) || tests.length === 0) return { isCorrect: null, score: 0, feedback: `${question.questionType.toUpperCase()} tests are not configured; submitted for review.`, requiresReview: true, gradingStatus: 'manual_review' }
    if (tests.length > 500) return { isCorrect: null, score: 0, feedback: 'Too many automated tests are configured.', requiresReview: true, gradingStatus: 'manual_review' }

    const result = await runIsolated({
      language: question.questionType,
      code: answer,
      dataset: cfg.dataset ?? question.datasetId,
      tests,
      timeoutMs: validateTimeout(cfg.timeoutMs),
    })
    if (!result.configured) return { isCorrect: null, score: 0, feedback: 'Isolated execution service is not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    if (!result.ok) return { isCorrect: null, score: 0, feedback: result.stderr || `${question.questionType.toUpperCase()} execution failed; review required.`, requiresReview: true, gradingStatus: 'failed' }
    return scoreTests(question, result.result, question.questionType === 'sql' ? 'SQL' : 'Python')
  }

  if (question.questionType === 'excel') return gradeExcel(question, answer)

  if (question.questionType === 'code') {
    const cfg = question.graderConfig ?? {}
    const language = String(cfg.language ?? 'python').toLowerCase()
    if (language !== 'python') return { isCorrect: null, score: 0, feedback: `Code execution for language "${language}" is not supported; submitted for review.`, requiresReview: true, gradingStatus: 'manual_review' }
    if (!Array.isArray(cfg.tests) || cfg.tests.length === 0) return { isCorrect: null, score: 0, feedback: 'Code tests are not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    const result = await runIsolated({ language: 'python', code: answer, dataset: cfg.dataset, tests: cfg.tests, timeoutMs: validateTimeout(cfg.timeoutMs) })
    if (!result.configured) return { isCorrect: null, score: 0, feedback: 'Isolated execution service is not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    if (!result.ok) return { isCorrect: null, score: 0, feedback: result.stderr || 'Code execution failed; review required.', requiresReview: true, gradingStatus: 'failed' }
    return scoreTests(question, result.result, 'Code')
  }

  const expected = String(question.answerKey ?? '').trim()
  if (!expected) return { isCorrect: null, score: 0, feedback: 'Automatic grading is not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
  const ok = norm(answer) === norm(expected)
  return { isCorrect: ok, score: ok ? marks : 0, feedback: ok ? 'Correct.' : 'Answer does not match the configured grading rule.', gradingStatus: 'completed' }
}
