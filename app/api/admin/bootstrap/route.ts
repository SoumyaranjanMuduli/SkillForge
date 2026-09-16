import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { isAuthorizedAdminEmail } from '@/lib/admin-config'

export async function POST() {
  const user = await getUser()
  if (!user || !user.email_confirmed_at || !isAuthorizedAdminEmail(user.email)) {
    return NextResponse.json({ error: 'A verified authorized admin account is required.' }, { status: 403 })
  }

  try {
    const db = createAdminClient()
    const { data: existing, error: lookupError } = await db
      .from('profiles')
      .select('id,role,status')
      .eq('id', user.id)
      .maybeSingle()

    if (lookupError) {
      console.error('[admin/bootstrap] profile lookup failed', lookupError.message)
      return NextResponse.json({ error: 'Could not verify the admin profile. Please try again.' }, { status: 500 })
    }
    if (existing?.status === 'disabled') {
      return NextResponse.json({ error: 'This admin account is disabled. Contact another administrator.' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { data: profile, error: upsertError } = await db
      .from('profiles')
      .upsert({ id: user.id, role: 'admin', status: 'active', updated_at: now }, { onConflict: 'id' })
      .select('id,role,status')
      .single()

    if (upsertError || !profile || profile.id !== user.id || profile.role !== 'admin' || profile.status !== 'active') {
      console.error('[admin/bootstrap] profile verification failed', upsertError)
      return NextResponse.json({ error: 'Admin profile could not be provisioned. Please try again.' }, { status: 500 })
    }

    const { error: auditError } = await db.from('audit_logs').insert({
      actor_id: user.id,
      action: 'bootstrap_admin',
      entity: 'profile',
      entity_id: user.id,
      new_value: { role: 'admin', status: 'active' },
    })

    if (auditError) console.error('[admin/bootstrap] audit log failed', auditError.message)
    return NextResponse.json({ ok: true, profile: { role: profile.role, status: profile.status } })
  } catch (error) {
    console.error('[admin/bootstrap] unexpected error', error)
    return NextResponse.json({ error: 'Admin setup is temporarily unavailable.' }, { status: 503 })
  }
}
