import { redirect } from 'next/navigation'
import { AppShell, PageTitle } from '@/components/AppShell'
import { getPrograms, getQuestionSuccessRates, listPracticeQuestions, getServerUser } from '@/lib/assessment'
import { PracticeList } from '@/components/PracticeList'

export const dynamic = 'force-dynamic'

export default async function PracticePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const [questions, programs] = await Promise.all([listPracticeQuestions(), getPrograms()])
  const successRates = await getQuestionSuccessRates(questions.map((q) => q.id))

  return <AppShell>
    <PageTitle eyebrow="Student" title="Practice" desc="Solve real problems, run your code instantly, and see success rates from the whole community — no timer, no pressure." />
    <PracticeList questions={questions} programs={programs} successRates={successRates} />
  </AppShell>
}
