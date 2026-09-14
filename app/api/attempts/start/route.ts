import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessibleAssessment, getQuestionsForGrading, getServerUser } from '@/lib/assessment'
import { enforceRateLimit } from '@/lib/rate-limit'

const bodySchema = z.object({ assessmentId: z.string().min(1) })
const shuffle = <T,>(xs: T[]) => {
  const out = [...xs]
  for (let i=out.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [out[i],out[j]]=[out[j],out[i]] }
  return out
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error:'Invalid assessment id.' }, { status:400 })
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error:'Authentication required' }, { status:401 })
  if (!(await enforceRateLimit(`attempt-start:${user.id}`))) return NextResponse.json({ error:'Too many attempt-start requests. Try again shortly.' }, { status:429 })
  const assessment = await getAccessibleAssessment(parsed.data.assessmentId,user.id)
  if (!assessment) return NextResponse.json({ error:'Assessment not found or not available.' }, { status:404 })
  const admin = createAdminClient() as any
  const questions = await getQuestionsForGrading(assessment.questionIds)
  if (!questions.length) return NextResponse.json({ error:'Assessment has no published questions.' }, { status:409 })
  const { data: aq } = await admin.from('assessment_questions').select('question_id,marks_override,time_limit_override_sec').eq('assessment_id', assessment.id)
  const overrides = new Map<string,{marks_override:number|null,time_limit_override_sec:number|null}>((aq ?? []).map((x:any)=>[x.question_id,x] as [string,{marks_override:number|null,time_limit_override_sec:number|null}]))
  const configured = questions.map(q => { const x=overrides.get(q.id); return x ? {...q, marks:x.marks_override ?? q.marks, timeLimitSec:x.time_limit_override_sec ?? q.timeLimitSec} : q })
  const order = assessment.randomizeQuestions ? shuffle(configured) : configured
  const maxScore = order.reduce((n,q)=>n+q.marks,0)
  const { data, error } = await admin.rpc('start_attempt_atomic',{p_assessment_id:assessment.id,p_user_id:user.id,p_question_order:order.map(q=>q.id),p_max_score:maxScore})
  if (error) {
    if (String(error.message).includes('MAX_ATTEMPTS')) return NextResponse.json({ error:'Maximum attempts reached.' }, { status:409 })
    return NextResponse.json({ error:'Could not start attempt. Apply db/migrations/002_production_pass.sql first.' }, { status:500 })
  }
  const row=data?.[0]
  if (!row) return NextResponse.json({ error:'Could not start attempt.' }, { status:500 })
  if (row.resumed) return NextResponse.json({attemptId:row.attempt_id,startedAt:row.started_at,resumed:true})
  const snapshots=order.map(q=>{
    const choices = assessment.randomizeOptions && q.choices ? shuffle(q.choices) : q.choices
    return {attempt_id:row.attempt_id,question_id:q.id,question_version:q.version??1,question_snapshot:{id:q.id,programId:q.programId,topic:q.topic,subtopic:q.subtopic,title:q.title,prompt:q.prompt,questionType:q.questionType,difficulty:q.difficulty,marks:q.marks,timeLimitSec:q.timeLimitSec,instructions:q.instructions,datasetId:q.datasetId,starterCode:q.starterCode,choices,tags:q.tags,gradingMode:q.gradingMode,explanation:q.explanation},answer_key_snapshot:q.answerKey==null?null:String(q.answerKey),grader_config_snapshot:q.graderConfig??{}}
  })
  const { error:snapErr }=await admin.from('attempt_question_snapshots').insert(snapshots)
  if(snapErr){await admin.from('attempts').delete().eq('id',row.attempt_id);return NextResponse.json({error:'Could not create assessment snapshot.'},{status:500})}
  return NextResponse.json({attemptId:row.attempt_id,startedAt:row.started_at,questionOrder:order.map(q=>q.id)})
}
