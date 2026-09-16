import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const schema = z.object({ userId: z.string().uuid(), status: z.enum(['active', 'disabled']), role: z.enum(['user', 'admin']).optional() })

export async function PATCH(req: Request) {
  const actor = await requireAdmin().catch(() => null)
  if (!actor) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid user update payload.' }, { status: 400 })
  if (parsed.data.userId === actor.id && parsed.data.status === 'disabled') return NextResponse.json({ error: 'You cannot disable your own account.' }, { status: 400 })

  try {
    const db = createAdminClient() as any
    const patch: Record<string, unknown> = { status: parsed.data.status, updated_at: new Date().toISOString() }
    if (parsed.data.role) patch.role = parsed.data.role
    const { data, error } = await db.from('profiles').update(patch).eq('id', parsed.data.userId).select('id').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    const { error: auditError } = await db.from('audit_logs').insert({ actor_id: actor.id, action: 'update_user_access', entity: 'profile', entity_id: parsed.data.userId, new_value: patch })
    if (auditError) throw auditError
    return NextResponse.json({ ok: true })
  } catch {
    console.error('[admin/users] update failed')
    return NextResponse.json({ error: 'Could not update user.' }, { status: 500 })
  }
}
