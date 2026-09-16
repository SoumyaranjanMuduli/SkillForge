import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const schema = z.object({ id: z.string().uuid().optional(), programId: z.string().trim().min(1).max(80), parentId: z.string().uuid().nullable().optional(), name: z.string().trim().min(1).max(160), slug: z.string().regex(/^[a-z0-9-]+$/).max(180), description: z.string().max(2000).default(''), status: z.enum(['active', 'archived']).default('active') })

export async function POST(req: Request) {
  const actor = await requireAdmin().catch(() => null)
  if (!actor) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid topic payload.' }, { status: 400 })
  try {
    const db = createAdminClient() as any
    const { programId, parentId, ...rest } = parsed.data
    const row = { ...rest, id: parsed.data.id ?? crypto.randomUUID(), program_id: programId, parent_id: parentId ?? null }
    const { error } = await db.from('topics').upsert(row)
    if (error) throw error
    await db.from('audit_logs').insert({ actor_id: actor.id, action: 'upsert_topic', entity: 'topic', entity_id: row.id, new_value: row })
    return NextResponse.json({ ok: true, id: row.id })
  } catch {
    console.error('[admin/topics] save failed')
    return NextResponse.json({ error: 'Could not save topic.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) { return POST(req) }

export async function DELETE(req: Request) {
  const actor = await requireAdmin().catch(() => null)
  if (!actor) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return NextResponse.json({ error: 'Valid topic id required.' }, { status: 400 })
  try {
    const db = createAdminClient() as any
    const { data, error } = await db.from('topics').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', parsed.data).select('id').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Topic not found.' }, { status: 404 })
    await db.from('audit_logs').insert({ actor_id: actor.id, action: 'archive_topic', entity: 'topic', entity_id: parsed.data })
    return NextResponse.json({ ok: true })
  } catch {
    console.error('[admin/topics] archive failed')
    return NextResponse.json({ error: 'Could not archive topic.' }, { status: 500 })
  }
}
