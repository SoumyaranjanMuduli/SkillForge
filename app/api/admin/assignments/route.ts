import {NextResponse} from 'next/server';import {z} from 'zod';import {createAdminClient} from '@/lib/supabase/admin';import {requireAdmin} from '@/lib/auth';import {sendAssessmentAssignedEmail} from '@/lib/notifications'
const schema=z.object({assessmentId:z.string().trim().min(1).max(120),userIds:z.array(z.string().uuid()).min(1).max(500).transform(ids=>[...new Set(ids)])});
export async function POST(req:Request){const actor=await requireAdmin().catch(()=>null);if(!actor)return NextResponse.json({error:'Admin access required'},{status:403});const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:p.error.flatten()},{status:400});const db=createAdminClient() as any;const rows=p.data.userIds.map(user_id=>({assessment_id:p.data.assessmentId,user_id}));const {error}=await db.from('assessment_assignments').upsert(rows,{onConflict:'assessment_id,user_id'});if(error)return NextResponse.json({error:'Could not assign assessment.'},{status:500});await db.from('audit_logs').insert({actor_id:actor.id,action:'assign_assessment',entity:'assessment',entity_id:p.data.assessmentId,new_value:{userIds:p.data.userIds}})
  // Best-effort notification fan-out — assignment already succeeded above regardless of this.
  try {
    const { data: assessment } = await db.from('assessments').select('name').eq('id', p.data.assessmentId).maybeSingle()
    await Promise.all(p.data.userIds.map(async (userId) => {
      const { data: u } = await db.auth.admin.getUserById(userId)
      await sendAssessmentAssignedEmail(u?.user?.email, assessment?.name ?? 'a new assessment', p.data.assessmentId)
    }))
  } catch (err) { console.error('[assignments] notification failed', err) }
  return NextResponse.json({ok:true,count:rows.length})}
