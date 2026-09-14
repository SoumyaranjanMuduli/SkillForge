import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'

const ADMIN_EMAIL='soumyaranjanliku16@gmail.com'

export async function POST(){
  const user=await getUser()
  if(!user||user.email?.toLowerCase()!==ADMIN_EMAIL||!user.email_confirmed_at)return NextResponse.json({error:'Verified admin email required.'},{status:403})
  const db=createAdminClient()
  const {error}=await db.from('profiles').update({role:'admin',status:'active',updated_at:new Date().toISOString()}).eq('id',user.id)
  if(error)return NextResponse.json({error:'Could not create admin account.'},{status:500})
  await db.from('audit_logs').insert({actor_id:user.id,action:'bootstrap_admin',entity:'profile',entity_id:user.id,new_value:{role:'admin'}})
  return NextResponse.json({ok:true})
}
