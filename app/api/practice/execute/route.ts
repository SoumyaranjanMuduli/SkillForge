import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/lib/assessment'
import { enforceRateLimit } from '@/lib/rate-limit'
import { runIsolated } from '@/lib/execution'

const scalar = z.union([z.string().max(2_000), z.number().finite(), z.boolean(), z.null()])
const datasetRow = z.record(scalar).refine(row => Object.keys(row).length <= 100, 'Too many columns.')
const datasetSchema = z.record(datasetRow.array().max(500)).refine(value => Object.keys(value).length <= 20, 'Too many tables.')
const testSchema = z.record(z.unknown()).refine(value => Object.keys(value).length <= 20, 'Too many test fields.')
const schema = z.object({
 language:z.union([z.literal('python'),z.literal('sql')]), code:z.string().min(1).max(100_000),
 tests:testSchema.array().max(50).optional(), dataset:datasetSchema.optional(), timeoutMs:z.number().int().min(250).max(5_000).optional(),
}).superRefine((value,ctx)=>{ if(Buffer.byteLength(JSON.stringify(value),'utf8')>1_500_000) ctx.addIssue({code:z.ZodIssueCode.custom,message:'Execution payload is too large.'}) })

export async function POST(req:Request){
 const user=await getServerUser(); if(!user) return NextResponse.json({error:'Authentication required'},{status:401})
 if(!(await enforceRateLimit(`practice-execute:${user.id}`))) return NextResponse.json({error:'Too many execution requests. Try again shortly.'},{status:429})
 const contentLength=Number(req.headers.get('content-length')??0); if(Number.isFinite(contentLength)&&contentLength>1_600_000) return NextResponse.json({error:'Execution payload is too large.'},{status:413})
 const parsed=schema.safeParse(await req.json().catch(()=>null)); if(!parsed.success) return NextResponse.json({error:'Invalid execution payload.'},{status:400})
 try{ const result=await runIsolated(parsed.data); if(!result.configured) return NextResponse.json({error:'Execution service is not configured.'},{status:503}); if(!result.ok) return NextResponse.json({error:result.stderr??'Execution failed.'},{status:422}); return NextResponse.json({ok:true,result:result.result,stdout:result.stdout??''}) }
 catch(err){ console.error('[practice/execute] failed',err); return NextResponse.json({error:'Execution failed.'},{status:500}) }
}
