import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { getQuestion, getServerUser } from '@/lib/assessment'
import { difficultyBadgeClass } from '@/lib/ui-helpers'
import { PracticeRunner } from '@/components/PracticeRunner'
import { listPracticeQuestions } from '@/lib/assessment'
import { PracticeQueue } from '@/components/PracticeQueue'

export const dynamic = 'force-dynamic'

export default async function PracticeQuestionPage({ params }: { params: Promise<{ questionId: string }> }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const { questionId } = await params
  const [question, allQuestions] = await Promise.all([getQuestion(questionId), listPracticeQuestions()])
  if (!question) return <AppShell><div className="card p-8 text-center text-sm text-slate-500">This challenge isn&apos;t available.</div></AppShell>

  const relatedQuestions = allQuestions.filter(q => q.programId === question.programId && q.id !== question.id).slice(0, 24)

  return <AppShell>
    <Link href="/practice" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand"><ArrowLeft size={15} /> Back to Practice</Link>
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      <div className="card h-fit p-6 animate-fade-in-up">
        <div className="flex flex-wrap items-center gap-2">
          <span className={difficultyBadgeClass(question.difficulty)}>{question.difficulty}</span>
          <span className="badge">{question.topic}</span>
          <span className="badge">Max Score: {question.marks}</span>
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-900">{question.title}</h1>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{question.prompt}</p>
        {question.instructions && <div className="mt-4 rounded-xl border border-line bg-slate-50 p-4 text-xs leading-6 text-slate-500">{question.instructions}</div>}
      </div>
      <PracticeRunner question={question} />
    </div>
    <PracticeQueue questions={relatedQuestions} programId={question.programId} />
  </AppShell>
}
