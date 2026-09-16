import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { getAdminEmail, getAuthRedirectOrigin, isAuthorizedAdminEmail } from '@/lib/admin-config'
import { enforceRateLimit } from '@/lib/rate-limit'

const requestSchema = z.object({ email: z.string().trim().email().max(320) })

function isAlreadyRegistered(message: string) {
  return /already registered|already exists|already been registered/i.test(message)
}

function isRateLimited(message: string) {
  return /rate limit|too many|429|over_email_send_rate_limit/i.test(message)
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ authorized: false }, { status: 401 })
  if (!isAuthorizedAdminEmail(user.email)) return NextResponse.json({ authorized: false })

  try {
    const db = createAdminClient()
    const { data: profile, error } = await db
      .from('profiles')
      .select('role,status')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      authorized: true,
      ready: profile?.role === 'admin' && profile.status !== 'disabled',
      confirmed: Boolean(user.email_confirmed_at),
    })
  } catch (error) {
    console.error('[admin/setup] status lookup failed', error)
    return NextResponse.json({ error: 'Could not verify admin setup status.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const adminEmail = getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json(
      { error: 'Admin setup is not configured on the server.' },
      { status: 503 },
    )
  }

  const origin = request.headers.get('origin')
  if (origin) {
    try {
      if (origin !== getAuthRedirectOrigin(request)) {
        return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 })
      }
    } catch {
      return NextResponse.json(
        { error: 'Admin setup is not configured securely on the server.' },
        { status: 503 },
      )
    }
  }

  const currentUser = await getUser()
  if (currentUser?.email && isAuthorizedAdminEmail(currentUser.email)) {
    return NextResponse.json({
      error: 'Admin setup is already associated with this account. Use password recovery instead.',
      mode: 'recovery',
    }, { status: 409 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid admin email address.' }, { status: 400 })
  }

  const requestedEmail = parsed.data.email.toLowerCase()
  if (requestedEmail !== adminEmail) {
    return NextResponse.json({ error: 'Admin setup is not available for this email.' }, { status: 403 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!(await enforceRateLimit(`admin-setup:${ip}:${adminEmail}`))) {
    return NextResponse.json(
      { error: 'Too many setup requests. Please try again later.' },
      { status: 429 },
    )
  }

  try {
    const redirectTo = `${getAuthRedirectOrigin(request)}/auth/callback?next=/admin/create-password`
    const db = createAdminClient()

    // Existing Supabase Auth users cannot be invited again. In that case,
    // return recovery mode so the browser sends the password-reset email.
    const { data: usersData, error: usersError } = await db.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (usersError) {
      console.error('[admin/setup] user lookup failed', usersError.message)
      return NextResponse.json(
        { error: 'Could not verify the admin account. Please try again later.' },
        { status: 500 },
      )
    }

    const existingUser = usersData.users.find(
      user => user.email?.trim().toLowerCase() === adminEmail,
    )

    if (existingUser) {
      return NextResponse.json({ ok: true, mode: 'recovery' })
    }

    const { error: inviteError } = await db.auth.admin.inviteUserByEmail(adminEmail, { redirectTo })

    if (!inviteError) {
      return NextResponse.json({ ok: true, mode: 'invite' })
    }

    if (isRateLimited(inviteError.message)) {
      return NextResponse.json(
        {
          error: 'Email sending is temporarily rate-limited. Please wait and try again.',
          retryable: true,
        },
        { status: 429 },
      )
    }

    // A concurrent signup may have created the user after listUsers().
    // Fall back to recovery instead of returning the misleading setup error.
    if (isAlreadyRegistered(inviteError.message)) {
      return NextResponse.json({ ok: true, mode: 'recovery' })
    }

    console.error('[admin/setup] invite failed', inviteError.message)
    return NextResponse.json(
      { error: 'We could not start admin setup. Please try again later.' },
      { status: 500 },
    )
  } catch (error) {
    console.error('[admin/setup] unexpected error', error)
    return NextResponse.json(
      { error: 'We could not start admin setup. Please try again later.' },
      { status: 500 },
    )
  }
}
