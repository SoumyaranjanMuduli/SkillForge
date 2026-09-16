'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { difficultyBadgeClass } from '@/lib/ui-helpers'

type Row = { id: string; title: string; program: string; topic: string; question_type: string; marks: number; difficulty: string; status: string; version: number }

const PAGE_SIZE = 8

const NEXT_STATUS: Record<string, { label: string; next: string } | undefined> = {
  draft: { label: 'Send to review', next: 'in_review' },
  in_review: { label: 'Publish', next: 'published' },
}

export function QuestionsTable({ rows, programs, initialProgram = 'all' }: { rows: Row[]; programs: string[]; initialProgram?: string }) {
  const [search, setSearch] = useState('')
  const [program, setProgram] = useState(initialProgram)
  const [page, setPage] = useState(1)
  const [localRows, setLocalRows] = useState(rows)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setLocalRows(rows) }, [rows])

  async function advanceStatus(id: string, next: string) {
    setPendingId(id)
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      })
      if (res.ok) setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)))
    } finally {
      setPendingId(null)
    }
  }

  const filtered = useMemo(
    () => localRows.filter((r) => (program === 'all' || r.program === program) && (!search || r.title.toLowerCase().includes(search.toLowerCase()))),
    [localRows, search, program]
  )

  useEffect(() => { setPage(1) }, [search, program])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return <div>
    <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="input !py-2 !pl-9" />
      </div>
      <select value={program} onChange={(e) => setProgram(e.target.value)} className="input w-auto !py-2">
        <option value="all">All Programs</option>
        {programs.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>

    <div className="card overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>{['#', 'Question', 'Program', 'Difficulty', 'Marks', 'Status', 'Actions'].map((x) => <th className="px-5 py-3.5" key={x}>{x}</th>)}</tr>
          </thead>
          <tbody className="stagger">
            {pageRows.map((x, i) => (
              <tr key={x.id} className="border-t border-line transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-4 text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td className="px-5 py-4 font-semibold text-slate-800">{x.title}<div className="mt-0.5 text-xs font-normal text-slate-400">{x.topic}</div></td>
                <td className="px-5 py-4 text-slate-500">{x.program}</td>
                <td className="px-5 py-4"><span className={difficultyBadgeClass(x.difficulty)}>{x.difficulty}</span></td>
                <td className="px-5 py-4 text-slate-500">{x.marks}</td>
                <td className="px-5 py-4"><span className="badge">{x.status}</span></td>
                <td className="px-5 py-4">
                  {NEXT_STATUS[x.status] ? (
                    <button
                      onClick={() => advanceStatus(x.id, NEXT_STATUS[x.status]!.next)}
                      disabled={pendingId === x.id}
                      className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50"
                    >
                      {pendingId === x.id ? 'Updating…' : NEXT_STATUS[x.status]!.label}
                    </button>
                  ) : <span className="text-xs text-slate-400">—</span>}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No questions match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-slate-400">
        <span>{filtered.length} questions</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-30">Prev</button>
          <span className="px-2 font-semibold text-slate-600">{page} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="rounded-lg px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-30">Next</button>
        </div>
      </div>
    </div>
  </div>
}
