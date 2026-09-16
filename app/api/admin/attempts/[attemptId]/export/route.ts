import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const { attemptId } = await params
  const db = createAdminClient() as any
  const { data: attempt } = await db.from('attempts').select('id,user_id,assessment_id,score,max_score,duration_sec,status,started_at,submitted_at,question_order').eq('id', attemptId).maybeSingle()
  if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })
  const [{ data: profile }, { data: assessment }, { data: answers }, { data: snaps }, auth] = await Promise.all([
    db.from('profiles').select('full_name,age,gender,birth_year').eq('id', attempt.user_id).maybeSingle(),
    db.from('assessments').select('name').eq('id', attempt.assessment_id).maybeSingle(),
    db.from('attempt_answers').select('question_id,answer,score,is_correct,time_spent_sec,admin_comment,feedback').eq('attempt_id', attemptId),
    db.from('attempt_question_snapshots').select('question_id,question_snapshot').eq('attempt_id', attemptId),
    db.auth.admin.getUserById(attempt.user_id),
  ])
  const answerEmail = auth?.data?.user?.email ?? ''
  const snapshotMap = new Map((snaps ?? []).map((s: any) => [s.question_id, s]))
  const orderedSnaps = (attempt.question_order ?? []).map((id: string) => snapshotMap.get(id)).filter(Boolean)
  const finalSnaps = orderedSnaps.length ? orderedSnaps : (snaps ?? [])
  const answersById = new Map<string, any>((answers ?? []).map((a: any) => [a.question_id, a]))
  const rows = finalSnaps.map((s: any, i: number) => {
    const q = s.question_snapshot ?? {}
    const a = answersById.get(s.question_id) ?? {}
    return { 'User Name': profile?.full_name ?? '', 'Email': answerEmail, 'Assessment': assessment?.name ?? '', 'Question No': i + 1, 'Question': q.title ?? '', 'Prompt': q.prompt ?? '', 'Answer': a.answer ?? '', 'Score': a.score ?? 0, 'Max Marks': q.marks ?? 0, 'Correct': a.is_correct === true ? 'Yes' : a.is_correct === false ? 'No' : 'Pending', 'Time (sec)': a.time_spent_sec ?? 0, 'Admin Comment': a.admin_comment ?? '', 'Feedback': a.feedback ?? '' }
  })
  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = Object.keys(rows[0] ?? { Question: '' }).map(key => ({ wch: Math.min(50, Math.max(12, key.length + 2)) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheet, 'Attempt')
  const info = XLSX.utils.json_to_sheet([{ 'User Name': profile?.full_name ?? '', 'Email': answerEmail, 'Assessment': assessment?.name ?? '', 'Score': attempt.score ?? 0, 'Max Score': attempt.max_score ?? 0, 'Status': attempt.status, 'Duration (sec)': attempt.duration_sec ?? 0, 'Started': attempt.started_at, 'Submitted': attempt.submitted_at }])
  XLSX.utils.book_append_sheet(wb, info, 'Summary')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buffer, { status: 200, headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="skillforge-${attemptId}.xlsx"`, 'cache-control': 'no-store' } })
}
