import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { applySecurityHeaders, isTrustedMutationRequest } from '@/lib/request-security'

const publicPaths = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/admin/login', '/admin/create-password', '/auth/callback'])
const publicApiPaths = new Set(['/api/admin/setup'])

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Generate a per-request nonce and forward it to Next.js. Next.js uses the
  // x-nonce request header for its generated inline/RSC scripts. The same
  // nonce is placed in the response CSP so those scripts are allowed to run.
  const nonce = btoa(crypto.randomUUID())
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } })

  if (path.startsWith('/api/') && !isTrustedMutationRequest(request)) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 }),
      nonce,
    )
  }

  const cfg = getSupabasePublicConfig()

  if (!cfg) {
    if (path.startsWith('/api/')) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 }),
        nonce,
      )
    }
    if (publicPaths.has(path)) return applySecurityHeaders(nextResponse(), nonce)
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/login?error=auth_not_configured', request.url)),
      nonce,
    )
  }

  // Public authentication pages must be renderable without a Supabase user lookup.
  // This avoids blocking the login/register UI on an auth refresh request and keeps
  // the public pages resilient when a deployment has a stale/expired auth cookie.
  if (publicPaths.has(path)) return applySecurityHeaders(nextResponse(), nonce)

  let response = nextResponse()
  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = nextResponse()
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const protectedPath = path === '/' || path.startsWith('/dashboard') || path.startsWith('/courses') || path.startsWith('/programs') || path.startsWith('/practice') || path.startsWith('/assessment') || path.startsWith('/assessments') || path.startsWith('/results') || path.startsWith('/notifications') || path.startsWith('/profile') || path.startsWith('/admin') || path.startsWith('/api/')

  if (!user && (protectedPath || path === '/account/setup') && !publicPaths.has(path) && !publicApiPaths.has(path)) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/login', request.url)), nonce)
  }

  if (user && (path === '/' || path === '/login' || path === '/register')) {
    const { data: profile } = await supabase.from('profiles').select('role,status,onboarding_complete').eq('id', user.id).maybeSingle()
    if (profile?.status === 'disabled') {
      await supabase.auth.signOut()
      return applySecurityHeaders(NextResponse.redirect(new URL('/login?error=disabled', request.url)), nonce)
    }
    if (profile?.role === 'admin') return applySecurityHeaders(NextResponse.redirect(new URL('/admin/dashboard', request.url)), nonce)
    if (!profile?.onboarding_complete) return applySecurityHeaders(NextResponse.redirect(new URL('/account/setup', request.url)), nonce)
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), nonce)
  }

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('status,onboarding_complete,role').eq('id', user.id).maybeSingle()
    if (profile?.status === 'disabled') {
      await supabase.auth.signOut()
      return applySecurityHeaders(NextResponse.redirect(new URL('/login?error=disabled', request.url)), nonce)
    }
    if (path.startsWith('/admin/') && path !== '/admin/login' && path !== '/admin/create-password' && profile?.role !== 'admin') {
      return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), nonce)
    }
    if (!path.startsWith('/admin') && !path.startsWith('/api/admin') && !path.startsWith('/api/profile') && path !== '/account/setup' && profile?.role !== 'admin' && !profile?.onboarding_complete) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/account/setup', request.url)), nonce)
    }
  }

  if (user && path === '/account/setup') {
    const { data: profile } = await supabase.from('profiles').select('role,status,onboarding_complete').eq('id', user.id).maybeSingle()
    if (profile?.status === 'disabled') return applySecurityHeaders(NextResponse.redirect(new URL('/login?error=disabled', request.url)), nonce)
    if (profile?.role === 'admin' || profile?.onboarding_complete) {
      return applySecurityHeaders(NextResponse.redirect(new URL(profile?.role === 'admin' ? '/admin/dashboard' : '/dashboard', request.url)), nonce)
    }
  }

  return applySecurityHeaders(response, nonce)
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'] }