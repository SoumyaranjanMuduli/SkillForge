import { HyperFormula } from 'hyperformula'
import type { GradingQuestion } from './types'
import { runIsolated } from './execution'

export type GradeResult = { isCorrect: boolean | null; score: number; feedback: string; requiresReview?: boolean; gradingStatus?: 'completed'|'failed'|'manual_review' }
const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase()

// case_study and data_engineering are open-ended/written-response question types with no
// automated grader behind them (no rubric engine, no pipeline-execution sandbox). They must
// never fall through to the exact-string-match default below — that would grade a paragraph
// answer as right/wrong against a literal string, which is meaningless. They always go to
// manual review, same as an explicit 'manual_review' question type.
const ALWAYS_MANUAL_REVIEW_TYPES = new Set(['manual_review', 'case_study', 'data_engineering'])

export function requiresManualReview(question: Pick<GradingQuestion, 'questionType'|'gradingMode'|'graderConfig'>) {
  return ALWAYS_MANUAL_REVIEW_TYPES.has(question.questionType) || String(question.graderConfig?.mode ?? question.gradingMode ?? '').toLowerCase() === 'manual'
}

function scoreTests(q: GradingQuestion, result: any, label: string): GradeResult {
  const passed = typeof result?.passed === 'number' ? result.passed : result === true ? 1 : 0
  const total = typeof result?.total === 'number' ? result.total : 1
  const score = Math.max(0, Math.min(q.marks, q.marks * (passed / Math.max(total, 1))))
  return { isCorrect: passed === total, score, feedback: passed === total ? `All ${label} tests passed.` : `${passed}/${total} ${label} tests passed.`, gradingStatus: 'completed' }
}

function gradeExcel(q: GradingQuestion, answer: string): GradeResult {
  const cfg = q.graderConfig ?? {}
  let submission: any
  try { submission = JSON.parse(answer) } catch { return { isCorrect: null, score: 0, feedback: 'Excel submission must be workbook JSON.', requiresReview: true, gradingStatus: 'manual_review' } }
  const sheets = submission?.sheets ?? cfg.sheets
  const expected = cfg.expected
  if (!sheets || typeof sheets !== 'object' || Array.isArray(sheets) || !expected || typeof expected !== 'object') return { isCorrect: null, score: 0, feedback: 'Excel grading configuration is incomplete; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
  try {
    const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3' })
    const checks = Object.entries(expected as Record<string, any>)
    if (!checks.length) return { isCorrect: null, score: 0, feedback: 'Excel assessment has no expected cells.', requiresReview: true, gradingStatus: 'manual_review' }
    let passed = 0
    for (const [ref, rule] of checks) {
      const [sheetName, cell] = ref.includes('!') ? ref.split('!') : [Object.keys(sheets)[0] ?? 'Sheet1', ref]
      const sheetId = hf.getSheetId(sheetName)
      if (sheetId === undefined) continue
      const m = cell.match(/^([A-Z]+)(\d+)$/i); if (!m) continue
      let col = 0; for (const ch of m[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64; col--
      const row = Number(m[2]) - 1
      const value = hf.getCellValue({ sheet: sheetId, row, col })
      const expectedValue = rule?.value ?? rule?.calculatedValue
      const formula = hf.getCellFormula({ sheet: sheetId, row, col })
      const valueOk = expectedValue === undefined || norm(String(value ?? '')) === norm(String(expectedValue))
      const formulaOk = !rule?.formula || norm(String(formula ?? '')) === norm(String(rule.formula))
      if (valueOk && formulaOk) passed++
    }
    const score = q.marks * passed / checks.length
    return { isCorrect: passed === checks.length, score, feedback: passed === checks.length ? 'All Excel checks passed.' : `${passed}/${checks.length} Excel checks passed.`, gradingStatus: 'completed' }
  } catch (err) {
    return { isCorrect: null, score: 0, feedback: err instanceof Error ? err.message : 'Excel evaluation failed; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
  }
}

export async function gradeAnswer(question: GradingQuestion, answer: string): Promise<GradeResult> {
  if (requiresManualReview(question)) return { isCorrect: null, score: 0, feedback: 'Submitted for admin review.', requiresReview: true, gradingStatus: 'manual_review' }
  const mode = String(question.graderConfig?.mode ?? question.gradingMode ?? '').toLowerCase()
  if (question.questionType === 'numeric' || mode === 'numeric') {
    const expected = Number(question.answerKey), actual = Number(answer), tolerance = Number(question.graderConfig?.tolerance ?? 1e-9)
    const ok = Number.isFinite(expected) && Number.isFinite(actual) && Math.abs(expected - actual) <= tolerance
    return { isCorrect: ok, score: ok ? question.marks : 0, feedback: ok ? 'Correct.' : 'Incorrect numeric answer.', gradingStatus: 'completed' }
  }
  if (question.questionType === 'multi_select') {
    const expected = new Set(String(question.answerKey ?? '').split(',').map(norm).filter(Boolean)), actual = new Set(answer.split(',').map(norm).filter(Boolean))
    const partial = Boolean(question.graderConfig?.partial), hits = [...actual].filter(x => expected.has(x)).length, wrong = [...actual].filter(x => !expected.has(x)).length
    const ok = expected.size === actual.size && hits === expected.size
    const ratio = Math.max(0, (hits - wrong) / Math.max(expected.size, 1))
    return { isCorrect: ok, score: ok ? question.marks : partial ? Math.round(question.marks * ratio * 100) / 100 : 0, feedback: ok ? 'Correct.' : partial ? `Partial credit: ${hits}/${expected.size} correct selections.` : 'Incorrect selection.', gradingStatus: 'completed' }
  }
  if (question.questionType === 'sql') {
    const cfg = question.graderConfig ?? {}
    if (!cfg.tests && !cfg.expected) return { isCorrect: null, score: 0, feedback: 'SQL tests are not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    const result = await runIsolated({ language: 'sql', code: answer, dataset: cfg.dataset ?? question.datasetId, tests: cfg.tests, timeoutMs: Number(cfg.timeoutMs ?? 10000) })
    if (!result.configured) return { isCorrect: null, score: 0, feedback: 'SQL execution service is not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    if (!result.ok) return { isCorrect: null, score: 0, feedback: result.stderr || 'SQL execution failed; retry or review required.', requiresReview: true, gradingStatus: 'failed' }
    return scoreTests(question, result.result, 'SQL')
  }
  if (question.questionType === 'python') {
    const cfg = question.graderConfig ?? {}
    if (!cfg.tests) return { isCorrect: null, score: 0, feedback: 'Python tests are not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    const result = await runIsolated({ language: 'python', code: answer, dataset: cfg.dataset, tests: cfg.tests, timeoutMs: Number(cfg.timeoutMs ?? 10000) })
    if (!result.configured) return { isCorrect: null, score: 0, feedback: 'Python execution service is not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    if (!result.ok) return { isCorrect: null, score: 0, feedback: result.stderr || 'Python execution failed; retry or review required.', requiresReview: true, gradingStatus: 'failed' }
    return scoreTests(question, result.result, 'Python')
  }
  if (question.questionType === 'excel') return gradeExcel(question, answer)
  if (question.questionType === 'code') {
    // 'code' questions have no editor-enforced language, so the grader config must say which
    // sandbox to run them in. Today the isolated execution service only supports Python — that
    // is the same runner backing 'python' questions above (runner/server.py only accepts
    // language 'python' or 'sql'). Anything else (or no tests configured) is not silently
    // treated as a fill-in-the-blank; it goes to manual review with a clear reason.
    const cfg = question.graderConfig ?? {}
    const language = String(cfg.language ?? 'python').toLowerCase()
    if (language !== 'python') return { isCorrect: null, score: 0, feedback: `Code execution for language "${language}" is not supported by the execution service; submitted for review.`, requiresReview: true, gradingStatus: 'manual_review' }
    if (!cfg.tests) return { isCorrect: null, score: 0, feedback: 'Code tests are not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    const result = await runIsolated({ language: 'python', code: answer, dataset: cfg.dataset, tests: cfg.tests, timeoutMs: Number(cfg.timeoutMs ?? 10000) })
    if (!result.configured) return { isCorrect: null, score: 0, feedback: 'Code execution service is not configured; submitted for review.', requiresReview: true, gradingStatus: 'manual_review' }
    if (!result.ok) return { isCorrect: null, score: 0, feedback: result.stderr || 'Code execution failed; retry or review required.', requiresReview: true, gradingStatus: 'failed' }
    return scoreTests(question, result.result, 'Code')
  }
  const expected = String(question.answerKey ?? ''), ok = norm(answer) === norm(expected)
  return { isCorrect: ok, score: ok ? question.marks : 0, feedback: ok ? 'Correct.' : 'Answer does not match the configured grading rule.', gradingStatus: 'completed' }
}
