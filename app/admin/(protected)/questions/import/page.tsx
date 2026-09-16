'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ClipboardPaste, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { PasteImporter } from './PasteImporter'

type RowResult =
  | { row: number; ok: true; data: Record<string, unknown>; warnings: string[] }
  | { row: number; ok: false; errors: string[]; raw: Record<string, unknown> }

type ParseResponse = {
  filename: string
  totalRows: number
  validCount: number
  errorCount: number
  duplicateIds: string[]
  existingIds: string[]
  rows: RowResult[]
}

type Step = 'upload' | 'preview' | 'done'
type Source = 'file' | 'paste'

export default function ImportPage() {
  const params = useSearchParams()
  const lockedProgramId = params.get('program') ?? ''
  const lockedDifficulty = (params.get('difficulty') ?? '') as '' | 'easy' | 'medium' | 'hard'
  const fileInput = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [source, setSource] = useState<Source>('file')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [targetStatus, setTargetStatus] = useState<'draft' | 'in_review' | 'published'>('draft')
  const [commitResult, setCommitResult] = useState<{ count: number } | null>(null)

  async function handleFile(file: File) {
    setBusy(true)
    setError('')
    setCommitResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/questions/import/parse', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not parse file.')
        return
      }
      setParsed(json)
      setStep('preview')
    } catch {
      setError('Upload failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    if (!parsed) return
    const validRows = parsed.rows.filter((r): r is Extract<RowResult, { ok: true }> => r.ok).map((r) => r.data)
    if (validRows.length === 0) {
      setError('No valid rows to import.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/questions/import/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: parsed.filename, targetStatus, rows: validRows, lockedProgramId: lockedProgramId || undefined, lockedDifficulty: lockedDifficulty || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : JSON.stringify(json.error))
        return
      }
      setCommitResult({ count: json.count })
      setStep('done')
    } catch {
      setError('Import failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function handlePasteParsed(data: ParseResponse) {
    setParsed(data)
    setSource('paste')
    setStep('preview')
    setError('')
  }

  function downloadErrors() {
    if (!parsed) return
    const rows = parsed.rows.filter((r) => !r.ok).map((r) => {
      const raw = 'raw' in r ? r.raw : {}
      const errors = 'errors' in r ? r.errors.join(' | ') : ''
      return {
        row: r.row,
        id: String((raw as Record<string, unknown>).id ?? ''),
        title: String((raw as Record<string, unknown>).title ?? ''),
        errors,
      }
    })
    const csv = [
      'row,id,title,errors',
      ...rows.map((r) => [r.row, r.id, r.title, r.errors].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'skillforge-question-import-errors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setStep('upload')
    setSource('file')
    setParsed(null)
    setError('')
    setCommitResult(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <AppShell role="admin">
      <PageTitle
        eyebrow="Admin / Import"
        title="Bulk import questions"
        desc="Build a question bank at scale with Excel/CSV upload or direct paste. Validate, preview, version, review and publish without silent failures."
      />

      {lockedProgramId && <div className="mb-5 rounded-2xl border border-brand/15 bg-brand/5 p-4 text-sm text-slate-600"><b className="text-brand">Assessment upload:</b> questions will be stored under program <span className="font-semibold">{lockedProgramId}</span>{lockedDifficulty && <> · <span className="capitalize font-semibold">{lockedDifficulty}</span></>}. Spreadsheet values for these fields are overridden for this upload.</div>}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <a href="/templates/question-import-template.csv" download className="btn-secondary !px-4 !py-2 text-sm"><Download size={15} /> Download Excel/CSV template</a>
        <Link href="/admin/questions" className="text-sm text-slate-500 underline">Back to question bank</Link>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setSource('file')} className={`card flex items-start gap-4 p-5 text-left ${source === 'file' ? 'border-brand/30 ring-2 ring-brand/10' : ''}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><FileSpreadsheet size={20} /></span>
              <span><span className="block font-bold text-slate-900">Upload Excel / CSV</span><span className="mt-1 block text-sm text-slate-500">Best for large banks and repeat imports.</span></span>
            </button>
            <button type="button" onClick={() => setSource('paste')} className={`card flex items-start gap-4 p-5 text-left ${source === 'paste' ? 'border-brand/30 ring-2 ring-brand/10' : ''}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600"><ClipboardPaste size={20} /></span>
              <span><span className="block font-bold text-slate-900">Paste questions</span><span className="mt-1 block text-sm text-slate-500">Copy directly from Excel or Google Sheets.</span></span>
            </button>
          </div>

          {source === 'file' ? (
            <div className="card p-8 text-center">
              <Upload className="mx-auto mb-3 text-slate-400" size={28} />
              <p className="mb-4 text-sm text-slate-500">Drop a .xlsx, .xls or .csv file here, or choose one below. Nothing is saved until you review and confirm.</p>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
                className="mx-auto block text-sm"
              />
              {busy && <p className="mt-3 text-sm text-slate-400">Parsing and validating…</p>}
            </div>
          ) : (
            <PasteImporter onParsed={handlePasteParsed} disabled={busy} />
          )}
        </div>
      )}

      {step === 'preview' && parsed && (
        <div className="space-y-5">
          <div className="card flex flex-wrap items-center gap-6 p-5">
            <div><div className="text-2xl font-bold">{parsed.totalRows}</div><div className="text-xs text-slate-500">Rows found</div></div>
            <div><div className="text-2xl font-bold text-emerald-600">{parsed.validCount}</div><div className="text-xs text-slate-500">Valid</div></div>
            <div><div className="text-2xl font-bold text-red-600">{parsed.errorCount}</div><div className="text-xs text-slate-500">Errors</div></div>
            {parsed.duplicateIds.length > 0 && <div className="text-sm text-amber-700">Duplicate ids in this import: {parsed.duplicateIds.join(', ')}</div>}
            {parsed.existingIds?.length > 0 && <div className="text-sm text-violet-700">Existing ids will create a new question version: {parsed.existingIds.join(', ')}</div>}
          </div>

          <div className="card max-h-[480px] overflow-auto p-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">ID</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody>
                {parsed.rows.map((r) => (
                  <tr key={r.row} className={`border-t border-line ${r.ok ? '' : 'bg-red-50/60'}`}>
                    <td className="px-4 py-3 text-slate-400">{r.row}</td>
                    {r.ok ? (
                      <>
                        <td className="px-4 py-3 font-mono text-xs">{String(r.data.id)}</td>
                        <td className="px-4 py-3">{String(r.data.title)}</td>
                        <td className="px-4 py-3 text-slate-500">{String(r.data.questionType)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Ready</span>
                          {r.warnings.length > 0 && <div className="mt-1 text-xs text-amber-600">{r.warnings.join('; ')}</div>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-xs">{String(r.raw.id ?? '—')}</td>
                        <td className="px-4 py-3">{String(r.raw.title ?? '—')}</td>
                        <td className="px-4 py-3 text-slate-500">{String(r.raw.questionType ?? '—')}</td>
                        <td className="px-4 py-3 text-red-700">
                          <span className="inline-flex items-center gap-1"><AlertTriangle size={14} /> {r.errors.length} error{r.errors.length === 1 ? '' : 's'}</span>
                          <div className="mt-1 text-xs">{r.errors.join('; ')}</div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card flex flex-wrap items-center gap-4 p-5">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="label mb-0">Import valid rows as</span>
              <select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value as typeof targetStatus)} className="input w-auto !py-2">
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="published">Published</option>
              </select>
            </label>
            <button className="btn-primary" disabled={busy || parsed.validCount === 0} onClick={() => void commit()}>
              {busy ? 'Importing…' : `Import ${parsed.validCount} question${parsed.validCount === 1 ? '' : 's'}`}
            </button>
            <button className="btn-secondary" onClick={reset} disabled={busy}>Start over</button>
            {parsed.errorCount > 0 && <button className="btn-secondary" onClick={downloadErrors}><Download size={15} /> Download error report</button>}
            {source === 'paste' && <span className="text-xs text-slate-500">Pasted rows were validated on the server using the same schema as Excel imports.</span>}
          </div>
        </div>
      )}

      {step === 'done' && commitResult && (
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={28} />
          <p className="mb-4 text-sm text-slate-600">Imported {commitResult.count} question{commitResult.count === 1 ? '' : 's'} as <b>{targetStatus.replace('_', ' ')}</b>.</p>
          <div className="flex justify-center gap-3">
            <Link href="/admin/questions" className="btn-primary">View question bank</Link>
            <button className="btn-secondary" onClick={reset}>Import another file</button>
          </div>
        </div>
      )}
    </AppShell>
  )
}
