import 'server-only'

import sqlBank from '@/data/practice/sql.json'
import pythonBank from '@/data/practice/python.json'
import excelBank from '@/data/practice/excel.json'
import numpyBank from '@/data/practice/numpy.json'
import pandasBank from '@/data/practice/pandas.json'
import type { Question } from './types'

const rawBanks = [sqlBank, pythonBank, excelBank, numpyBank, pandasBank] as unknown as Question[][]


const byProgram = new Map<string, Question[]>()
for (const bank of rawBanks) {
  const rows = bank as Question[]
  if (!rows.length) continue
  byProgram.set(rows[0].programId, rows)
}

const publicQuestion = (q: Question): Question => {
  const { answerKey: _answerKey, graderConfig: _graderConfig, ...safe } = q
  return safe
}

export function listBuiltInPracticeQuestions(): Question[] {
  return [...byProgram.values()].flat().map(publicQuestion)
}

export function isBuiltInPracticeQuestion(id: string): boolean {
  return id.startsWith('practice-sql-') || id.startsWith('practice-python-') || id.startsWith('practice-excel-') || id.startsWith('practice-numpy-') || id.startsWith('practice-pandas-')
}

export function getBuiltInPracticeQuestion(id: string): Question | null {
  for (const rows of byProgram.values()) {
    const found = rows.find(q => q.id === id)
    if (found) return publicQuestion(found)
  }
  return null
}
