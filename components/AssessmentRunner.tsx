'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, PartyPopper, WifiOff } from 'lucide-react'
import type { Assessment, Question } from '@/lib/types'
import { QuestionAnswer } from '@/components/QuestionAnswer'
import { difficultyBadgeClass } from '@/lib/ui-helpers'

export function AssessmentRunner({ assessment, questions: initialQuestions }: { assessment: Assessment; questions: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [timeByQuestion, setTimeByQuestion] = useState<Record<string,number>>({})
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now())
  const [secondsLeft, setSecondsLeft] = useState(assessment.durationSec)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [savedState, setSavedState] = useState<'saved'|'saving'|'offline'>('saved')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const startedAtRef = useRef<number | null>(null)

  const q = questions[current]
  const progress = ((current + 1) / Math.max(questions.length, 1)) * 100

  useEffect(() => {
    let cancelled = false
    void fetch('/api/attempts/start', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({assessmentId:assessment.id}) })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Could not start assessment')
        if (cancelled) return
        setAttemptId(body.attemptId)
        const attemptRes = await fetch(`/api/attempts/${body.attemptId}`, { cache:'no-store' })
        const attemptBody = await attemptRes.json()
        if (!attemptRes.ok) throw new Error(attemptBody.error ?? 'Could not load attempt')
        if (attemptBody.questions?.length) setQuestions(attemptBody.questions)
        const restored: Record<string,string> = {}
        for (const a of attemptBody.answers ?? []) restored[a.question_id] = a.answer ?? ''
        setAnswers(restored)
        const started = new Date(attemptBody.attempt?.started_at ?? body.startedAt).getTime()
        startedAtRef.current = started
        setQuestionStartedAt(Date.now())
        setSecondsLeft(Math.max(0, assessment.durationSec - Math.floor((Date.now() - started) / 1000)))
      })
      .catch(() => { if (!cancelled) setSavedState('offline') })
    return () => { cancelled = true }
  }, [assessment.id, assessment.durationSec])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (startedAtRef.current == null) return
      setSecondsLeft(Math.max(0, assessment.durationSec - Math.floor((Date.now() - startedAtRef.current) / 1000)))
    }, 1000)
    return () => window.clearInterval(id)
  }, [assessment.durationSec])

  useEffect(() => {
    if (secondsLeft !== 0 || submitted || !attemptId) return
    void submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, attemptId, submitted])

  useEffect(() => {
    if (!attemptId || !q) return
    const id = window.setTimeout(() => void saveCurrent(), 900)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers[q?.id ?? ''], attemptId, q?.id])

  function addQuestionTime() {
    if (!q) return 0
    const delta = Math.max(0, Math.floor((Date.now() - questionStartedAt) / 1000))
    const next = (timeByQuestion[q.id] ?? 0) + delta
    setTimeByQuestion(v => ({ ...v, [q.id]: next }))
    setQuestionStartedAt(Date.now())
    return next
  }

  async function saveCurrent() {
    if (!attemptId || !q) return false
    const time = addQuestionTime()
    setSavedState('saving')
    try {
      const res = await fetch(`/api/attempts/${attemptId}/answer`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ questionId:q.id, answer:answers[q.id] ?? '', timeSpentSec:time }) })
      if (!res.ok) throw new Error('save failed')
      setSavedState('saved')
      return true
    } catch {
      setSavedState('offline')
      return false
    }
  }

  async function goTo(i: number) {
    await saveCurrent()
    setCurrent(i)
    setQuestionStartedAt(Date.now())
  }

  async function nextQuestion() { await goTo(Math.min(questions.length - 1, current + 1)) }
  async function previousQuestion() { await goTo(Math.max(0, current - 1)) }

  async function submit() {
    if (busy) return
    setBusy(true)
    await saveCurrent()
    if (!attemptId) { setBusy(false); setSavedState('offline'); return }
    const res = await fetch(`/api/attempts/${attemptId}/submit`, { method:'POST' })
    if (res.ok) { setSubmitted(true); window.location.href = `/results/${attemptId}`; return }
    setBusy(false)
  }

  if (submitted) return <div className="grid min-h-screen place-items-center bg-surface p-6">
    <div className="card max-w-lg animate-pop-in p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><PartyPopper size={26} /></div>
      <div className="badge-brand mt-4">Submitted</div>
      <h1 className="mt-4 text-2xl font-black text-slate-900">Assessment saved</h1>
      <p className="mt-2 text-sm text-slate-500">We&apos;re taking you to your results.</p>
      <Link href="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  </div>
  if (!q) return <div className="grid min-h-screen place-items-center p-6"><div className="card p-8">No questions are available.</div></div>

  return <main className="min-h-screen bg-surface">
    <div className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div>
          <Link href="/dashboard" className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-brand"><ChevronLeft size={14} /> Back to Dashboard</Link>
          <h1 className="mt-1 text-lg font-black text-slate-900">{assessment.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
            {savedState === 'saved' && <><CheckCircle2 size={13} className="text-emerald-500" /> Saved</>}
            {savedState === 'saving' && <>Saving…</>}
            {savedState === 'offline' && <><WifiOff size={13} className="text-rose-500" /> Offline — retrying</>}
          </span>
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold tabular-nums ${secondsLeft < 120 ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-line bg-slate-50 text-slate-800'}`}>
            <Clock size={15} /> {formatTime(secondsLeft)}
          </div>
          <button onClick={() => void submit()} disabled={busy} className="btn-primary !bg-brand">{busy ? 'Submitting…' : 'Finish Test'}</button>
        </div>
      </div>
      <div className="h-1 w-full bg-slate-100"><div className="h-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} /></div>
    </div>

    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 md:px-8 lg:grid-cols-[220px_1fr]">
      <aside className="card h-fit overflow-hidden lg:sticky lg:top-24">
        <div className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Questions</div>
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {questions.map((x, i) => {
            const answered = Boolean(answers[x.id])
            const isCurrent = i === current
            return <button key={x.id} onClick={() => void goTo(i)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${isCurrent ? 'bg-brand/10 font-semibold text-brand' : 'text-slate-500 hover:bg-slate-50'}`}>
              {answered ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className={isCurrent ? 'text-brand' : 'text-slate-300'} />}
              Question {i + 1}
            </button>
          })}
        </div>
      </aside>

      <div className="card p-5 md:p-7 animate-fade-in-up" key={q.id}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="badge">Question {current + 1} of {questions.length}</span>
            <span className={difficultyBadgeClass(q.difficulty)}>{cap(q.difficulty)}</span>
          </div>
          <div className="text-right text-xs text-slate-400">{q.marks} marks · {Math.round(q.timeLimitSec / 60)} min</div>
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{q.title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{q.prompt}</p>
        {q.instructions && <p className="mt-2 text-xs text-slate-400">{q.instructions}</p>}

        <QuestionAnswer q={q} value={answers[q.id] ?? q.starterCode ?? ''} onChange={value => setAnswers(a => ({ ...a, [q.id]: value }))} />

        <div className="mt-7 flex flex-wrap justify-between gap-3">
          <button className="btn-secondary" disabled={current === 0} onClick={() => void previousQuestion()}><ChevronLeft size={16} /> Previous</button>
          {current < questions.length - 1
            ? <button className="btn-primary" onClick={() => void nextQuestion()}>Next <ChevronRight size={16} /></button>
            : <button className="btn-primary !bg-emerald-600 hover:!bg-emerald-700" disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit assessment'}</button>}
        </div>
      </div>
    </div>
  </main>
}

function formatTime(sec:number) { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60; return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
