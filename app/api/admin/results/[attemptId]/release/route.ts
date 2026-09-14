import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { sendResultReleasedEmail } from '@/lib/notifications'
export async function POST(_:Request,{params}:{params:Promise<{attemptId:string}>}){
  const adminUser=await requireAdmin().catch(()=>null); if(!adminUser)return NextResponse.json({error:'Admin access required'},{status:403})
  const {attemptId}=await params; const db=createAdminClient() as any
  const {data:a}=await db.from('attempts').select('id,status,result_released_at,user_id,assessments(name)').eq('id',attemptId).maybeSingle(); if(!a)return NextResponse.json({error:'Attempt not found.'},{status:404})
  if(a.status==='released'||a.result_released_at)return NextResponse.json({error:'Result is already released.'},{status:409})
  if(!['auto_graded','approved'].includes(a.status))return NextResponse.json({error:'Complete all required manual reviews before release.'},{status:409})
  const now=new Date().toISOString(); const {error}=await db.from('attempts').update({result_released_at:now,status:'released'}).eq('id',attemptId)
  if(error)return NextResponse.json({error:'Could not release result.'},{status:500})
  await db.from('audit_logs').insert({actor_id:adminUser.id,action:'release_result',entity:'attempt',entity_id:attemptId,new_value:{releasedAt:now}})
  // Best-effort: never let a notification failure undo or mask a successful release.
  try {
    const { data: u } = await db.auth.admin.getUserById(a.user_id)
    await sendResultReleasedEmail(u?.user?.email, a.assessments?.name ?? 'your assessment', attemptId)
  } catch (err) { console.error('[release] notification failed', err) }
  return NextResponse.json({ok:true})
}
