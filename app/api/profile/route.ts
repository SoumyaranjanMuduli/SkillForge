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

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  try {
    const db = createAdminClient() as any
    const { data, error } = await db.from('profiles').select('full_name,age,gender,birth_year').eq('id', user.id).maybeSingle()
    if (error) throw error
    return NextResponse.json({ fullName: data?.full_name ?? '', age: data?.age ?? null, gender: data?.gender ?? '', birthYear: data?.birth_year ?? null, email: user.email ?? '' })
  } catch {
    console.error('[profile] load failed')
    return NextResponse.json({ error: 'Could not load profile.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile details.' }, { status: 400 })

  try {
    const db = createAdminClient() as any
    const { data, error } = await db.from('profiles').update({
      full_name: parsed.data.fullName,
      age: parsed.data.age,
      gender: parsed.data.gender,
      birth_year: parsed.data.birthYear,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id).select('id').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    console.error('[profile] update failed')
    return NextResponse.json({ error: 'Could not save profile.' }, { status: 500 })
  }
}
