import { redirect } from 'next/navigation'
import { getAccessibleAssessment, getQuestions, getServerUser } from '@/lib/assessment'
import { AssessmentRunner } from '@/components/AssessmentRunner'

export const dynamic = 'force-dynamic'

export default async function AssessmentPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')
  const assessment = await getAccessibleAssessment(assessmentId, user.id)
  if (!assessment) return <div className="grid min-h-screen place-items-center p-6"><div className="card p-8">Assessment not found or unavailable.</div></div>
  const questions = await getQuestions(assessment.questionIds)
  if (!questions.length) return <div className="grid min-h-screen place-items-center p-6"><div className="card p-8">This assessment has no published questions.</div></div>
  return <AssessmentRunner assessment={assessment} questions={questions} />
}
