'use client'

import { useState } from 'react'
import { ClipboardPaste, Download, Loader2, Sparkles } from 'lucide-react'

type Props = {
  onParsed: (data: {
    filename: string
    totalRows: number
    validCount: number
    errorCount: number
    duplicateIds: string[]
    existingIds: string[]
    rows: any[]
  }) => void
  disabled?: boolean
}

export function PasteImporter({ onParsed, disabled }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function parse() {
    const value = text.trim()
    if (!value) {
      setError('Paste your question rows first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/questions/import/paste', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: value }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not parse pasted questions.')
        return
      }
      onParsed(json)
    } catch {
      setError('Paste parsing failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function insertExample() {
    setText([
      'questionid\tprogram\ttopic\ttitle\tquestiontype\tdifficulty\tmarks\ttimelimitsec\tquestion\tanswerkey\tchoices',
      'sql-101\tsql\tSELECT\tFind top customers\tsql\teasy\t5\t180\tWrite a query that returns the top 5 customers by spend.\tSELECT customer_id, SUM(amount) AS spend FROM orders GROUP BY customer_id ORDER BY spend DESC LIMIT 5\t',
      'sql-102\tsql\tJoins\tChoose the valid join\tmcq\tmedium\t5\t120\tWhich join keeps every row from the left table?\tLEFT JOIN\tINNER JOIN|LEFT JOIN|RIGHT JOIN|CROSS JOIN',
    ].join('\n'))
  }

  function downloadGuide() {
    const guide = [
      'Paste format: TSV copied from Excel/Google Sheets, with the first row as headers.',
      'Required columns: questionid, program, topic, title, questiontype, difficulty, marks, timelimitsec, question, answerkey',
      'Optional: subtopic, instructions, choices, gradingmode, startercode, graderconfig, explanation, tags, status',
      'Supported question types: mcq, multi_select, true_false, text, numeric, sql, python, excel, code, data_engineering, case_study, manual_review',
    ].join('\n')
    const blob = new Blob([guide], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'skillforge-question-paste-guide.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><ClipboardPaste size={17} className="text-brand" /> Paste questions</div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Paste rows directly from Excel, Google Sheets, CSV, TSV, or a tab-separated question bank. The server validates everything before import.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={insertExample} disabled={disabled || busy}><Sparkles size={15} /> Example</button>
          <button type="button" className="btn-secondary" onClick={downloadGuide} disabled={disabled || busy}><Download size={15} /> Paste guide</button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled || busy}
        placeholder="Paste Excel rows here…"
        className="input min-h-64 resize-y font-mono text-xs leading-5"
        spellCheck={false}
      />
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Tip: copying selected cells from Excel preserves tabs and maps cleanly to the import template.</p>
        <button type="button" className="btn-primary" onClick={() => void parse()} disabled={disabled || busy || !text.trim()}>
          {busy ? <><Loader2 size={15} className="animate-spin" /> Validating…</> : <><ClipboardPaste size={15} /> Validate pasted rows</>}
        </button>
      </div>
    </div>
  )
}
