import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { getAdminEmail, getAuthRedirectOrigin, isAuthorizedAdminEmail } from '@/lib/admin-config'
import { enforceRateLimit } from '@/lib/rate-limit'

const requestSchema = z.object({ email: z.string().trim().email().max(320) })

function isAlreadyRegistered(message: string) { return /already registered|already exists|already been registered/i.test(message) }
function isRateLimited(message: string) { return /rate limit|too many|429|over_email_send_rate_limit/i.test(message) }

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ authorized: false }, { status: 401 })
  if (!isAuthorizedAdminEmail(user.email)) return NextResponse.json({ authorized: false })

  try {
    const db = createAdminClient()
    const { data: profile, error } = await db.from('profiles').select('role,status').eq('id', user.id).maybeSingle()
    if (error) throw error
    return NextResponse.json({ authorized: true, ready: profile?.role === 'admin' && profile.status !== 'disabled', confirmed: Boolean(user.email_confirmed_at) })
  } catch {
    console.error('[admin/setup] status lookup failed')
    return NextResponse.json({ error: 'Could not verify admin setup status.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const adminEmail = getAdminEmail()
  if (!adminEmail) return NextResponse.json({ error: 'Admin setup is not configured on the server.' }, { status: 503 })

  const origin = request.headers.get('origin')
  if (origin) {
    try {
      if (origin !== getAuthRedirectOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 })
    } catch {
      return NextResponse.json({ error: 'Admin setup is not configured securely on the server.' }, { status: 503 })
    }
  }

  const user = await getUser()
  if (user?.email && isAuthorizedAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin setup is already associated with this account. Use the normal password-recovery flow.' }, { status: 409 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid admin email address.' }, { status: 400 })
  if (parsed.data.email.toLowerCase() !== adminEmail) return NextResponse.json({ error: 'Admin setup is not available for this email.' }, { status: 403 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!(await enforceRateLimit(`admin-setup:${ip}:${adminEmail.toLowerCase()}`))) {
    return NextResponse.json({ error: 'Too many setup requests. Please try again later.' }, { status: 429 })
  }

  try {
    const redirectTo = `${getAuthRedirectOrigin(request)}/auth/callback?next=/admin/create-password`
    const db = createAdminClient()
    const { error } = await db.auth.admin.inviteUserByEmail(adminEmail, { redirectTo })
    if (!error) return NextResponse.json({ ok: true, mode: 'invite' })
    if (isRateLimited(error.message)) return NextResponse.json({ error: 'Email sending is temporarily rate-limited. Please wait and try again.', retryable: true }, { status: 429 })
    if (isAlreadyRegistered(error.message)) return NextResponse.json({ error: 'This admin account already exists. Use password recovery instead.' }, { status: 409 })
    console.error('[admin/setup] invite failed')
    return NextResponse.json({ error: 'We could not start admin setup. Please try again later.' }, { status: 500 })
  } catch {
    console.error('[admin/setup] unexpected error')
    return NextResponse.json({ error: 'We could not start admin setup. Please try again later.' }, { status: 500 })
  }
}
