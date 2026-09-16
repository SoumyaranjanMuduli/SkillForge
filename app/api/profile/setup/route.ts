import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/lib/assessment'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  age: z.number().int().min(13).max(100),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say', 'other']),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
})

export async function POST(req: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Please enter valid profile details.' }, { status: 400 })

  const db = createAdminClient() as any
  const { data: updated, error } = await db.from('profiles').update({
    full_name: parsed.data.fullName,
    age: parsed.data.age,
    gender: parsed.data.gender,
    birth_year: parsed.data.birthYear,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id).select('id').maybeSingle()

  if (error || !updated) return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
