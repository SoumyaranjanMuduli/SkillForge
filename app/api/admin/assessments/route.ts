import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const schema=z.object({id:z.string().trim().min(2).max(120),name:z.string().trim().min(1).max(200),description:z.string().max(5000).default(''),programId:z.string().min(1),durationSec:z.number().int().positive(),passingScore:z.number().min(0).max(100).default(60),maxAttempts:z.number().int().min(0).default(0),randomizeQuestions:z.boolean().default(false),randomizeOptions:z.boolean().default(false),startDate:z.string().datetime().nullable().optional(),endDate:z.string().datetime().nullable().optional(),published:z.boolean().default(false),questionIds:z.array(z.union([z.string().min(1),z.object({questionId:z.string().min(1),marksOverride:z.number().int().positive().nullable().optional(),timeLimitOverrideSec:z.number().int().positive().nullable().optional()})])).min(1)})

export async function POST(req:Request){
 const actor=await requireAdmin().catch(()=>null); if(!actor)return NextResponse.json({error:'Admin access required'},{status:403})
 const p=schema.safeParse(await req.json().catch(()=>null)); if(!p.success)return NextResponse.json({error:p.error.flatten()},{status:400})
 const db=createAdminClient() as any
 const ids=p.data.questionIds.map((q:any)=>typeof q==='string'?q:q.questionId)
 const {data:valid}=await db.from('questions').select('id,program_id').in('id',ids)
 if((valid??[]).length!==new Set(ids).size || (valid??[]).some((q:any)=>q.program_id!==p.data.programId)) return NextResponse.json({error:'All selected questions must exist and belong to the selected program.'},{status:400})
 const assessment={...p.data,startDate:p.data.startDate??null,endDate:p.data.endDate??null}
 const questions=p.data.questionIds.map((q:any,position)=>({questionId:typeof q==='string'?q:q.questionId,position:position+1,marksOverride:typeof q==='string'?null:q.marksOverride??null,timeLimitOverrideSec:typeof q==='string'?null:q.timeLimitOverrideSec??null}))
 const {error}=await db.rpc('save_assessment_atomic',{p_assessment:assessment,p_questions:questions,p_actor:actor.id})
 if(error)return NextResponse.json({error:'Could not save assessment. Apply db/migrations/003_production_hardening.sql.'},{status:500})
 await db.from('audit_logs').insert({actor_id:actor.id,action:'upsert_assessment',entity:'assessment',entity_id:p.data.id,new_value:{...assessment,questionIds:ids}})
 return NextResponse.json({ok:true,id:p.data.id})
}
