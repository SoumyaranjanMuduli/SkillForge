import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isTrustedMutationRequest } from '@/lib/request-security'

const schema = z.object({
  accessToken: z.string().min(1).max(16_384),
  refreshToken: z.string().min(1).max(16_384),
})

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid authentication session.' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.setSession({
      access_token: parsed.data.accessToken,
      refresh_token: parsed.data.refreshToken,
    })

    if (error || !data.session || !data.user) {
      console.error('[auth/sync-session] session sync failed', error?.message)
      return NextResponse.json({ error: 'Could not establish your secure session. Please sign in again.' }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth/sync-session] unexpected error', error)
    return NextResponse.json({ error: 'Authentication is temporarily unavailable. Please try again.' }, { status: 503 })
  }
}
