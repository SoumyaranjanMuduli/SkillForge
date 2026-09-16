import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/assessment'

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  age: z.number().int().min(13).max(100),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say', 'other']),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
})

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

async function resolveUser(req: Request) {
  const token = getBearerToken(req)
  const db = createAdminClient()

  if (token) {
    const { data, error } = await db.auth.getUser(token)
    if (!error && data.user) {
      const { data: profile } = await db.from('profiles').select('status').eq('id', data.user.id).maybeSingle()
      if (profile?.status === 'disabled') return null
      return data.user
    }
  }

  return getServerUser()
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Please enter valid profile details.' }, { status: 400 })

  try {
    const db = createAdminClient()
    const { data: updated, error } = await db
      .from('profiles')
      .update({
        full_name: parsed.data.fullName,
        age: parsed.data.age,
        gender: parsed.data.gender,
        birth_year: parsed.data.birthYear,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[profile/setup] update failed', error.message)
      return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 })
    }
    if (!updated) return NextResponse.json({ error: 'Your profile could not be found.' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[profile/setup] unexpected error', error)
    return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 })
  }
}
