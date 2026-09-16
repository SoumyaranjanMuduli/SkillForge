'use client'

import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { HyperFormula } from 'hyperformula'
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react'
import type { Question } from '@/lib/types'

const EMP = [
  { EMPNO:7369, ENAME:'SMITH', JOB:'CLERK', MGR:7902, HIREDATE:'1980-12-17', SAL:800, COMM:null, DEPTNO:20 },
  { EMPNO:7499, ENAME:'ALLEN', JOB:'SALESMAN', MGR:7698, HIREDATE:'1981-02-20', SAL:1600, COMM:300, DEPTNO:30 },
  { EMPNO:7521, ENAME:'WARD', JOB:'SALESMAN', MGR:7698, HIREDATE:'1981-02-22', SAL:1250, COMM:500, DEPTNO:30 },
  { EMPNO:7566, ENAME:'JONES', JOB:'MANAGER', MGR:7839, HIREDATE:'1981-04-02', SAL:2975, COMM:null, DEPTNO:20 },
  { EMPNO:7654, ENAME:'MARTIN', JOB:'SALESMAN', MGR:7698, HIREDATE:'1981-09-28', SAL:1250, COMM:1400, DEPTNO:30 },
  { EMPNO:7698, ENAME:'BLAKE', JOB:'MANAGER', MGR:7839, HIREDATE:'1981-05-01', SAL:2850, COMM:null, DEPTNO:30 },
  { EMPNO:7782, ENAME:'CLARK', JOB:'MANAGER', MGR:7839, HIREDATE:'1981-06-09', SAL:2450, COMM:null, DEPTNO:10 },
  { EMPNO:7788, ENAME:'SCOTT', JOB:'ANALYST', MGR:7566, HIREDATE:'1987-04-19', SAL:3000, COMM:null, DEPTNO:20 },
  { EMPNO:7839, ENAME:'KING', JOB:'PRESIDENT', MGR:null, HIREDATE:'1981-11-17', SAL:5000, COMM:null, DEPTNO:10 },
  { EMPNO:7844, ENAME:'TURNER', JOB:'SALESMAN', MGR:7698, HIREDATE:'1981-09-08', SAL:1500, COMM:0, DEPTNO:30 },
  { EMPNO:7876, ENAME:'ADAMS', JOB:'CLERK', MGR:7788, HIREDATE:'1987-05-23', SAL:1100, COMM:null, DEPTNO:20 },
  { EMPNO:7900, ENAME:'JAMES', JOB:'CLERK', MGR:7698, HIREDATE:'1981-12-03', SAL:950, COMM:null, DEPTNO:30 },
  { EMPNO:7902, ENAME:'FORD', JOB:'ANALYST', MGR:7566, HIREDATE:'1981-12-03', SAL:3000, COMM:null, DEPTNO:20 },
  { EMPNO:7934, ENAME:'MILLER', JOB:'ANALYST', MGR:7782, HIREDATE:'1982-01-23', SAL:1300, COMM:null, DEPTNO:10 }
]
const DEPT = [{DEPTNO:10,DNAME:'ACCOUNTING',LOC:'NEW YORK'},{DEPTNO:20,DNAME:'RESEARCH',LOC:'DALLAS'},{DEPTNO:30,DNAME:'SALES',LOC:'CHICAGO'},{DEPTNO:40,DNAME:'OPERATIONS',LOC:'BOSTON'}]

const DEMO_DATASET: Record<string, Record<string, unknown>[]> = { EMP, DEPT }

type Props = { q: Question; value: string; onChange: (v: string) => void; allowRun?: boolean }
type RunState = 'idle' | 'running' | 'ok' | 'error'

export function CodeWorkspace({ q, value, onChange, allowRun = true }: Props) {
  const [output, setOutput] = useState('')
  const [state, setState] = useState<RunState>('idle')
  const [tab, setTab] = useState<'output' | 'schema'>('output')
  useEffect(() => {
    if (state !== 'ok') return
    const timer = window.setTimeout(() => setState('idle'), 2800)
    return () => window.clearTimeout(timer)
  }, [state])

  // Use the question's own dataset when it has one (this is what the server-side grader runs
  // the submission against too — see lib/grading.ts / runner/server.py). Only fall back to the
  // EMP/DEPT demo tables for questions that don't define a custom dataset (e.g. demo content),
  // so the in-browser preview never silently disagrees with how the answer is actually graded.
  const dataset = q.practiceDataset && Object.keys(q.practiceDataset).length ? q.practiceDataset : DEMO_DATASET
  const schema: Record<string, string[]> = Object.fromEntries(
    Object.entries(dataset).map(([table, rows]) => [table, rows[0] ? Object.keys(rows[0]) : []])
  )

  const normalizedValue = useMemo(() => q.questionType === 'sql' ? value.replaceAll('\\n', ' ').replace(/\s+/g, ' ').trim() : value, [q.questionType, value])

  async function run() {
    setState('running'); setTab('output'); setOutput('Running…')
    try {
      if (q.questionType === 'sql') {
        const result = await runSql(normalizedValue, dataset)
        setOutput(result)
        setState('ok')
      } else if (isPythonFamily) {
        const result = await runPython(value)
        setOutput(String(result ?? ''))
        setState('ok')
      } else if (q.questionType === 'excel') {
        const result = evaluateExcel(value)
        setOutput(result.output)
        setState(result.ok ? 'ok' : 'error')
      } else {
        setOutput('Use Submit to send this answer for grading.')
        setState('idle')
      }
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  const isPythonFamily = q.questionType === 'python' || q.programId === 'numpy' || q.programId === 'pandas'
  const language = isPythonFamily ? 'python' : q.questionType === 'sql' ? 'sql' : q.questionType === 'excel' ? 'excel' : 'text'
  const showSchema = q.questionType === 'sql'

  return <div className="mt-8 relative">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[.15em] text-slate-400">{q.programId === 'numpy' ? 'NumPy' : q.programId === 'pandas' ? 'Pandas' : language} workspace</span>
        {q.questionType === 'sql' && <span className="badge">ANSI SQL / DuckDB runner</span>}
      </div>
      {allowRun && q.questionType !== 'text' && (
        <button className="btn-primary !bg-emerald-600 !px-4 !py-2 hover:!bg-emerald-700" onClick={() => void run()} disabled={state === 'running'}>
          {state === 'running' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="white" />} {state === 'running' ? 'Running…' : 'Run'}
        </button>
      )}
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-card">
      <Editor height="320px" theme="vs-dark" language={language === 'excel' ? 'plaintext' : language} value={value} onChange={(v) => onChange(v ?? '')} options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', automaticLayout: true, tabSize: 2 }} />
    </div>

    {allowRun && <div className="mt-3 overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center gap-1 border-b border-line bg-slate-50 px-2 pt-2">
        <TabButton active={tab === 'output'} onClick={() => setTab('output')}>Output</TabButton>
        {showSchema && <TabButton active={tab === 'schema'} onClick={() => setTab('schema')}>Schema</TabButton>}
        <span className="ml-auto mr-2 mb-1">
          {state === 'ok' && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 animate-fade-in"><CheckCircle2 size={13} /> Ran successfully</span>}
          {state === 'error' && <span className="flex items-center gap-1 text-xs font-semibold text-rose-500 animate-fade-in"><XCircle size={13} /> Error</span>}
        </span>
      </div>
      <div className={`bg-slate-900 p-4 transition-colors ${state === 'error' ? 'ring-1 ring-inset ring-rose-500/40' : state === 'ok' ? 'ring-1 ring-inset ring-emerald-500/30' : ''}`}>
        {tab === 'output'
          ? <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-300">{output || 'Run the code to see output.'}</pre>
          : <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(schema).map(([table, cols]) => (
                <div key={table}>
                  <div className="text-xs font-bold uppercase tracking-wide text-brand">{table}</div>
                  <ul className="mt-2 space-y-1">
                    {cols.map((c) => <li key={c} className="font-mono text-xs text-slate-300">{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>}
      </div>
    </div>}

    {state === 'ok' && (
      <div role="status" aria-live="polite" className="fixed bottom-6 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-2xl animate-pop-in">
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
        <div><div className="text-sm font-black text-slate-900">Successfully completed</div><div className="mt-0.5 text-xs text-slate-500">Your code ran successfully. Check the result below.</div></div>
      </div>
    )}
  </div>
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-t-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-white text-brand border border-b-0 border-line' : 'text-slate-400 hover:text-slate-600'}`}>{children}</button>
}

async function runSql(code: string, dataset: Record<string, Record<string, unknown>[]>) {
  const res = await fetch('/api/practice/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language: 'sql', code, dataset, timeoutMs: 5_000 }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'SQL execution failed.')
  return JSON.stringify(body.result ?? '', null, 2)
}

async function runPython(code: string) {
  const res = await fetch('/api/practice/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language: 'python', code, timeoutMs: 5_000 }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'Python execution failed.')
  return body.stdout || JSON.stringify(body.result ?? '', null, 2)
}

function evaluateExcel(input: string): { ok: boolean; output: string } {
  try {
    const wb = JSON.parse(input)
    if (!wb?.sheets || typeof wb.sheets !== 'object' || Array.isArray(wb.sheets)) {
      return { ok: false, output: 'Enter workbook JSON: {\"sheets\":{\"Sheet1\":[[1,2],[3,\"=SUM(A1:B1)\"]]}}' }
    }
    const hf = HyperFormula.buildFromSheets(wb.sheets, { licenseKey: 'gpl-v3' })
    const out: Record<string, unknown> = {}
    for (const name of Object.keys(wb.sheets)) {
      const id = hf.getSheetId(name)
      if (id === undefined) continue
      out[name] = hf.getSheetValues(id)
    }
    return { ok: true, output: JSON.stringify(out, null, 2) }
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : 'Invalid workbook JSON.' }
  }
}
