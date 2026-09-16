import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

const schema = z.object({ id: z.string().trim().min(2).max(80), slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string().trim().min(1).max(120), description: z.string().max(2000).default(''), notes: z.string().max(50000).default(''), icon: z.string().max(40).default('book'), status: z.enum(['active', 'archived']).default('active') })

async function adminOr403() { return requireAdmin().catch(() => null) }

export async function POST(req: Request) {
  const actor = await adminOr403()
  if (!actor) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid program payload.' }, { status: 400 })
  try {
    const db = createAdminClient() as any
    const { error } = await db.from('programs').upsert(parsed.data)
    if (error) throw error
    await db.from('audit_logs').insert({ actor_id: actor.id, action: 'upsert_program', entity: 'program', entity_id: parsed.data.id, new_value: parsed.data })
    return NextResponse.json({ ok: true })
  } catch {
    console.error('[admin/programs] save failed')
    return NextResponse.json({ error: 'Could not save program.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) { return POST(req) }

export async function DELETE(req: Request) {
  const actor = await adminOr403()
  if (!actor) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id || id.length > 80) return NextResponse.json({ error: 'Program id required.' }, { status: 400 })
  try {
    const db = createAdminClient() as any
    const { data, error } = await db.from('programs').update({ status: 'archived' }).eq('id', id).select('id').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Program not found.' }, { status: 404 })
    await db.from('audit_logs').insert({ actor_id: actor.id, action: 'archive_program', entity: 'program', entity_id: id })
    return NextResponse.json({ ok: true })
  } catch {
    console.error('[admin/programs] archive failed')
    return NextResponse.json({ error: 'Could not archive program.' }, { status: 500 })
  }
}

export async function GET() {
  const actor = await adminOr403()
  if (!actor) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  try {
    const db = createAdminClient() as any
    const { data, error } = await db.from('programs').select('id,slug,name').eq('status', 'active').order('name')
    if (error) throw error
    return NextResponse.json({ programs: data ?? [] })
  } catch {
    console.error('[admin/programs] list failed')
    return NextResponse.json({ error: 'Could not load programs.' }, { status: 500 })
  }
}
