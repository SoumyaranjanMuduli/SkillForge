'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, PartyPopper, Play, WifiOff } from 'lucide-react'
import type { Assessment, Question } from '@/lib/types'
import { QuestionAnswer } from '@/components/QuestionAnswer'
import { difficultyBadgeClass } from '@/lib/ui-helpers'
import { normalizeSqlStarter } from '@/lib/code-utils'

export function AssessmentRunner({ assessment, questions: initialQuestions }: { assessment: Assessment; questions: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeByQuestion, setTimeByQuestion] = useState<Record<string, number>>({})
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(assessment.durationSec)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [savedState, setSavedState] = useState<'saved' | 'saving' | 'offline'>('saved')
  const [started, setStarted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState('')
  const startedAtRef = useRef<number | null>(null)

  const q = questions[current]
  const progress = ((current + 1) / Math.max(questions.length, 1)) * 100

  useEffect(() => {
    if (!started || !startedAtRef.current) return
    const id = window.setInterval(() => setSecondsLeft(Math.max(0, assessment.durationSec - Math.floor((Date.now() - (startedAtRef.current as number)) / 1000))), 1000)
    return () => window.clearInterval(id)
  }, [started, assessment.durationSec])

  useEffect(() => {
    if (!started || secondsLeft !== 0 || submitted || !attemptId) return
    void submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, started, attemptId, submitted])

  useEffect(() => {
    if (!started || !attemptId || !q) return
    const id = window.setTimeout(() => void saveCurrent(), 700)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers[q?.id ?? ''], attemptId, q?.id, started])

  async function startTest() {
    if (started || busy) return
    setBusy(true)
    setStartError('')
    try {
      const res = await fetch('/api/attempts/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assessmentId: assessment.id }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not start assessment')
      const attemptRes = await fetch(`/api/attempts/${body.attemptId}`, { cache: 'no-store' })
      const attemptBody = await attemptRes.json()
      if (!attemptRes.ok) throw new Error(attemptBody.error ?? 'Could not load assessment')
      setAttemptId(body.attemptId)
      if (attemptBody.questions?.length) setQuestions(attemptBody.questions)
      const restored: Record<string, string> = {}
      for (const a of attemptBody.answers ?? []) restored[a.question_id] = a.answer ?? ''
      setAnswers(restored)
      const startedAt = new Date(attemptBody.attempt?.started_at ?? body.startedAt).getTime()
      startedAtRef.current = startedAt
      setQuestionStartedAt(Date.now())
      setSecondsLeft(Math.max(0, assessment.durationSec - Math.floor((Date.now() - startedAt) / 1000)))
      setStarted(true)
      setSavedState('saved')
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not start assessment')
    } finally {
      setBusy(false)
    }
  }

  function addQuestionTime() {
    if (!q || !questionStartedAt) return 0
    const delta = Math.max(0, Math.floor((Date.now() - questionStartedAt) / 1000))
    const next = (timeByQuestion[q.id] ?? 0) + delta
    setTimeByQuestion(v => ({ ...v, [q.id]: next }))
    setQuestionStartedAt(Date.now())
    return next
  }

  async function saveCurrent() {
    if (!started || !attemptId || !q) return false
    const time = addQuestionTime()
    setSavedState('saving')
    try {
      const res = await fetch(`/api/attempts/${attemptId}/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ questionId: q.id, answer: answers[q.id] ?? '', timeSpentSec: time }) })
      if (!res.ok) throw new Error('save failed')
      setSavedState('saved')
      return true
    } catch {
      setSavedState('offline')
      return false
    }
  }

  async function goTo(i: number) {
    if (!started) return
    await saveCurrent()
    setCurrent(i)
    setQuestionStartedAt(Date.now())
  }

  async function submit() {
    if (busy || !started || !attemptId) return
    setBusy(true)
    try {
      const saved = await saveCurrent()
      if (!saved) {
        setBusy(false)
        return
      }
      const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Could not submit assessment.')
      setSubmitted(true)
      window.location.href = `/results/${attemptId}`
    } catch {
      setSavedState('offline')
      console.error('[AssessmentRunner] submit failed')
      setBusy(false)
    }
  }

  if (submitted) return <div className="grid min-h-screen place-items-center bg-surface p-6"><div className="card max-w-lg animate-pop-in p-10 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><PartyPopper size={26} /></div><div className="badge-brand mt-4">Submitted</div><h1 className="mt-4 text-2xl font-black text-slate-900">Assessment saved</h1><Link href="/dashboard" className="btn-primary mt-6">Back to dashboard</Link></div></div>
  if (!q) return <div className="grid min-h-screen place-items-center p-6"><div className="card max-w-lg p-8 text-center"><h1 className="text-xl font-bold">No questions are available.</h1><p className="mt-2 text-sm text-slate-500">This assessment hasn’t received published questions yet.</p><Link href="/assessments" className="btn-primary mt-5">Back to assessments</Link></div></div>

  return <main className="min-h-screen bg-surface">
    <div className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><Link href="/assessments" className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-brand"><ChevronLeft size={14} /> Back to Assessments</Link><h1 className="mt-1 text-lg font-black text-slate-900">{assessment.name}</h1></div>
          <div className="flex items-center gap-2">
            {started && <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">{savedState === 'saved' ? <><CheckCircle2 size={13} className="text-emerald-500" /> Saved</> : savedState === 'saving' ? 'Saving…' : <><WifiOff size={13} className="text-rose-500" /> Offline</>}</span>}
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold tabular-nums ${started && secondsLeft < 120 ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-line bg-slate-50 text-slate-800'}`}><Clock size={15} /> {started ? formatTime(secondsLeft) : formatTime(assessment.durationSec)}</div>
            {started ? <button onClick={() => void submit()} disabled={busy} className="btn-primary !bg-brand">{busy ? 'Submitting…' : 'Finish Test'}</button> : <button onClick={() => void startTest()} disabled={busy} className="btn-primary"><Play size={15} fill="white" />{busy ? 'Starting…' : 'Start Test'}</button>}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Start the test when you’re ready. The timer begins only after Start Test.</span><span>{questions.length} questions · {Math.round(assessment.durationSec / 60)} min</span></div>
      </div>
      <div className="h-1 w-full bg-slate-100"><div className="h-full bg-brand transition-all duration-500" style={{ width: `${started ? progress : 0}%` }} /></div>
    </div>

    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 md:px-8 lg:grid-cols-[220px_1fr]">
      <aside className="card h-fit overflow-hidden lg:sticky lg:top-28"><div className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Questions</div><div className="max-h-[70vh] overflow-y-auto p-2">{questions.map((x, i) => { const answered = Boolean(answers[x.id]); const isCurrent = i === current; return <button key={x.id} onClick={() => void goTo(i)} disabled={!started} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${isCurrent ? 'bg-brand/10 font-semibold text-brand' : 'text-slate-500 hover:bg-slate-50'}`}>{answered ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className={isCurrent ? 'text-brand' : 'text-slate-300'} />}Question {i + 1}</button> })}</div></aside>

      <div className="card p-5 md:p-7 animate-fade-in-up" key={q.id}>
        {!started && <div className="mb-6 rounded-2xl border border-brand/15 bg-brand/5 p-5"><div className="text-sm font-bold text-brand">Ready when you are.</div><p className="mt-1 text-sm leading-6 text-slate-500">Read each question before starting. Your answers are not submitted or timed until you press Start Test.</p>{startError && <p className="mt-2 text-sm text-rose-600">{startError}</p>}</div>}
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-2"><span className="badge">Question {current + 1} of {questions.length}</span><span className={difficultyBadgeClass(q.difficulty)}>{cap(q.difficulty)}</span></div><div className="text-right text-xs text-slate-400">{q.marks} marks · {Math.round(q.timeLimitSec / 60)} min</div></div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{q.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{q.prompt}</p>{q.instructions && <p className="mt-2 text-xs text-slate-400">{q.instructions}</p>}
        <div className={!started ? 'pointer-events-none opacity-65' : ''}><QuestionAnswer q={q} value={answers[q.id] ?? (q.questionType === 'sql' ? normalizeSqlStarter(q.starterCode ?? '') : (q.starterCode ?? ''))} onChange={value => setAnswers(a => ({ ...a, [q.id]: value }))} allowRun={false} /></div>
        <div className="mt-7 flex flex-wrap justify-between gap-3"><button className="btn-secondary" disabled={!started || current === 0} onClick={() => void goTo(Math.max(0, current - 1))}><ChevronLeft size={16} /> Previous</button>{current < questions.length - 1 ? <button className="btn-primary" disabled={!started} onClick={() => void goTo(current + 1)}>Next <ChevronRight size={16} /></button> : <button className="btn-primary !bg-emerald-600 hover:!bg-emerald-700" disabled={!started || busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Finish Test'}</button>}</div>
      </div>
    </div>
  </main>
}

function formatTime(sec: number) { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60; return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
