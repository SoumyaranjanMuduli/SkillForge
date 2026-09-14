import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const schema = z.object({
  id: z.string().trim().min(2).max(120), topicId: z.string().uuid().nullable().optional(), programId: z.string().trim().min(1).max(120), topic: z.string().trim().min(1).max(200),
  subtopic: z.string().trim().max(200).nullable().optional(), title: z.string().trim().min(1).max(500), prompt: z.string().min(1).max(50_000),
  questionType: z.enum(['mcq','multi_select','true_false','text','numeric','sql','python','excel','code','data_engineering','case_study','manual_review']),
  difficulty: z.enum(['easy','medium','hard']), marks: z.number().int().positive().max(1000), timeLimitSec: z.number().int().positive().max(86_400),
  instructions: z.string().max(20_000).optional(), starterCode: z.string().max(100_000).nullable().optional(), choices: z.array(z.string().max(1000)).max(100).nullable().optional(),
  answerKey: z.string().max(100_000).nullable().optional(), graderConfig: z.record(z.unknown()).optional(), gradingMode: z.string().max(80).optional(), explanation: z.string().max(20_000).optional(),
  status: z.enum(['draft', 'in_review', 'published', 'archived']).optional(),
})

export async function POST(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = z.array(schema).safeParse(Array.isArray(body) ? body : [body])
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const admin = createAdminClient()
  const programs = await admin.from('programs').select('id')
  const programIds = new Set((programs.data ?? []).map((p) => p.id))
  const invalidProgram = parsed.data.find((q) => !programIds.has(q.programId))
  if (invalidProgram) return NextResponse.json({ error: `Program "${invalidProgram.programId}" does not exist.` }, { status: 400 })
  const ids = parsed.data.map(q => q.id)
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (duplicateIds.length) return NextResponse.json({ error: `Duplicate question ids in this request: ${[...new Set(duplicateIds)].join(', ')}` }, { status: 400 })
  const { data: existing } = await admin.from('questions').select('*').in('id', ids)
  if (existing?.length) {
    const { error: versionError } = await admin.from('question_versions').upsert(
      existing.map((old:any)=>({question_id:old.id,version:old.version,snapshot:old,created_by:adminUser.id})),
      { onConflict: 'question_id,version', ignoreDuplicates: true }
    )
    if (versionError) return NextResponse.json({ error: 'Could not preserve question version history.' }, { status: 500 })
  }
  const versions = new Map((existing ?? []).map((q) => [q.id, q.version]))
  const existingById = new Map((existing ?? []).map((q:any) => [q.id, q]))
  const rows = parsed.data.map(q => ({
    id:q.id, program_id:q.programId, topic:q.topic, topic_id:q.topicId ?? null, subtopic:q.subtopic ?? null, title:q.title, prompt:q.prompt, question_type:q.questionType,
    difficulty:q.difficulty, marks:q.marks, time_limit_sec:q.timeLimitSec, instructions:q.instructions ?? '', starter_code:q.starterCode ?? null,
    choices:q.choices ?? null, answer_key:q.answerKey ?? null, grader_config:q.graderConfig ?? {}, grading_mode:q.gradingMode ?? 'exact',
    explanation:q.explanation ?? null, status:q.status ?? existingById.get(q.id)?.status ?? 'draft', version:(versions.get(q.id) ?? 0) + 1, created_by:adminUser.id, updated_at:new Date().toISOString()
  }))
  const { error } = await admin.from('questions').upsert(rows)
  if (error) return NextResponse.json({ error: 'Could not save questions.' }, { status: 500 })
  await admin.from('audit_logs').insert(rows.map((q) => ({ actor_id:adminUser.id, action:'upsert_question', entity:'question', entity_id:q.id, new_value:{version:q.version} })))
  return NextResponse.json({ count: rows.length })
}


export async function PATCH(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = schema.partial().extend({ id: z.string().min(2).max(120) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const db = createAdminClient() as any
  const q = parsed.data
  const {data:old}=await db.from('questions').select('*').eq('id',q.id).maybeSingle()
  if(!old)return NextResponse.json({error:'Question not found.'},{status:404})
  if (q.status) {
    const allowed = q.status === old.status ||
      (old.status === 'draft' && q.status === 'in_review') ||
      (old.status === 'in_review' && q.status === 'published') ||
      (old.status === 'published' && q.status === 'archived') ||
      (old.status === 'in_review' && q.status === 'archived') ||
      (old.status === 'draft' && q.status === 'archived')
    if (!allowed) return NextResponse.json({error:`Invalid status transition: ${old.status} → ${q.status}.`},{status:409})
  }
  const { error: versionError } = await db.from('question_versions').upsert(
    {question_id:q.id,version:old.version,snapshot:old,created_by:adminUser.id},
    { onConflict: 'question_id,version', ignoreDuplicates: true }
  )
  if (versionError) return NextResponse.json({error:'Could not preserve question version history.'},{status:500})
  const patch:any = {}
  for (const [k,v] of Object.entries(q)) {
    const key = ({programId:'program_id',topicId:'topic_id',questionType:'question_type',timeLimitSec:'time_limit_sec',starterCode:'starter_code',answerKey:'answer_key',graderConfig:'grader_config',gradingMode:'grading_mode'} as any)[k] ?? k
    if (k !== 'id') patch[key]=v
  }
  patch.updated_at=new Date().toISOString(); patch.version = (await db.from('questions').select('version').eq('id',q.id).maybeSingle()).data?.version + 1 || 1
  const {error}=await db.from('questions').update(patch).eq('id',q.id)
  if(error)return NextResponse.json({error:'Could not update question.'},{status:500})
  await db.from('audit_logs').insert({actor_id:adminUser.id,action:'update_question',entity:'question',entity_id:q.id,new_value:patch})
  return NextResponse.json({ok:true})
}

export async function DELETE(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const { searchParams } = new URL(req.url); const id=searchParams.get('id')
  if(!id)return NextResponse.json({error:'Question id is required.'},{status:400})
  const db=createAdminClient() as any; const {error}=await db.from('questions').update({status:'archived',updated_at:new Date().toISOString()}).eq('id',id)
  if(error)return NextResponse.json({error:'Could not archive question.'},{status:500})
  await db.from('audit_logs').insert({actor_id:adminUser.id,action:'archive_question',entity:'question',entity_id:id})
  return NextResponse.json({ok:true})
}
