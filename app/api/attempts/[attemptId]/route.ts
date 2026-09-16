import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/assessment'
export async function GET(_:Request,{params}:{params:Promise<{attemptId:string}>}){
  const user=await getServerUser(); if(!user)return NextResponse.json({error:'Authentication required'},{status:401})
  const {attemptId}=await params; const db=createAdminClient() as any
  const {data:a}=await db.from('attempts').select('id,assessment_id,user_id,started_at,status,duration_sec,score,max_score,question_order').eq('id',attemptId).maybeSingle()
  if(!a||a.user_id!==user.id)return NextResponse.json({error:'Attempt not found.'},{status:404})
  const [{data:s},{data:answers}]=await Promise.all([db.from('attempt_question_snapshots').select('question_id,question_snapshot').eq('attempt_id',attemptId),db.from('attempt_answers').select('question_id,answer,time_spent_sec').eq('attempt_id',attemptId)])
  const order=(a.question_order??[]) as string[]; const by=new Map((s??[]).map((x:any)=>[x.question_id,x.question_snapshot]))
  // Never include grading explanations in an active assessment response. They
  // remain in the immutable server-side snapshot for the released-result view.
  const questions=order.map(id=>{
    const snapshot=by.get(id) as Record<string, unknown> | undefined
    if (!snapshot) return undefined
    const safeQuestion = { ...snapshot }
    delete safeQuestion.explanation
    return safeQuestion
  }).filter(Boolean)
  return NextResponse.json({attempt:a,questions,answers:answers??[]})
}
