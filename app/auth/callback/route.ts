import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_NEXT = '/dashboard'

function safeNext(value: string | null) {
  if (!value) return DEFAULT_NEXT
  return value.startsWith('/') && !value.startsWith('//') ? value : DEFAULT_NEXT
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as 'signup' | 'recovery' | 'email' | 'email_change' | null
  const next = safeNext(url.searchParams.get('next'))

  let supabase
  try { supabase = await createClient() } catch {
    return NextResponse.redirect(new URL('/login?error=auth_not_configured', url.origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL('/login?error=callback_failed', url.origin))
    return NextResponse.redirect(new URL(next, url.origin))
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return NextResponse.redirect(new URL('/login?error=verification_failed', url.origin))
    return NextResponse.redirect(new URL(next, url.origin))
  }

  return NextResponse.redirect(new URL('/login?error=invalid_callback', url.origin))
}
