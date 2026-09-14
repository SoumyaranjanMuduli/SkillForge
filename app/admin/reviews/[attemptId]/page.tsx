import { notFound } from 'next/navigation'
import { getAdminAttempt } from '@/lib/admin-attempt'
import { AdminReview } from './review-client'

export default async function ReviewAttemptPage({ params }: { params: Promise<{ attemptId:string }> }) {
  const { attemptId } = await params
  const attempt = await getAdminAttempt(attemptId)
  if (!attempt) notFound()
  return <AdminReview attempt={attempt} />
}
