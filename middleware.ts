import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { applySecurityHeaders, buildCspHeader, isTrustedMutationRequest } from '@/lib/request-security'

const publicPaths = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/admin/login', '/admin/create-password', '/auth/callback'])
const publicApiPaths = new Set(['/api/admin/setup'])

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // One nonce per request, forwarded to the app on the request's own CSP
  // header so Next.js can stamp it onto the inline RSC-hydration script it
  // injects into every page, then echoed on the response so the browser
  // enforces the same policy. Without this, a nonce-less `script-src 'self'`
  // silently blocks that inline script in production and the page never
  // hydrates (renders blank) — see lib/request-security.ts.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCspHeader(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const nextOpts = { request: { headers: requestHeaders } }

  if (path.startsWith('/api/') && !isTrustedMutationRequest(request)) {
    return applySecurityHeaders(NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 }), csp)
  }
  const cfg = getSupabasePublicConfig()

  if (!cfg) {
    if (path.startsWith('/api/')) return applySecurityHeaders(NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 }), csp)
    if (publicPaths.has(path)) return applySecurityHeaders(NextResponse.next(nextOpts), csp)
    return applySecurityHeaders(NextResponse.redirect(new URL('/login?error=auth_not_configured', request.url)), csp)
  }

  // Public authentication pages must be renderable without a Supabase user lookup.
  // This avoids blocking the login/register UI on an auth refresh request and keeps
  // the public pages resilient when a deployment has a stale/expired auth cookie.
  if (publicPaths.has(path)) return applySecurityHeaders(NextResponse.next(nextOpts), csp)

  let response = NextResponse.next(nextOpts)
  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next(nextOpts)
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const protectedPath = path === '/' || path.startsWith('/dashboard') || path.startsWith('/courses') || path.startsWith('/programs') || path.startsWith('/practice') || path.startsWith('/assessment') || path.startsWith('/assessments') || path.startsWith('/results') || path.startsWith('/notifications') || path.startsWith('/profile') || path.startsWith('/admin') || path.startsWith('/api/')

  if (!user && (protectedPath || path === '/account/setup') && !publicPaths.has(path) && !publicApiPaths.has(path)) return applySecurityHeaders(NextResponse.redirect(new URL('/login', request.url)), csp)
  if (user && (path === '/' || path === '/login' || path === '/register')) {
    const { data: profile } = await supabase.from('profiles').select('role,status,onboarding_complete').eq('id', user.id).maybeSingle()
    if (profile?.status === 'disabled') {
      await supabase.auth.signOut()
      return applySecurityHeaders(NextResponse.redirect(new URL('/login?error=disabled', request.url)), csp)
    }
    if (profile?.role === 'admin') return applySecurityHeaders(NextResponse.redirect(new URL('/admin/dashboard', request.url)), csp)
    if (!profile?.onboarding_complete) return applySecurityHeaders(NextResponse.redirect(new URL('/account/setup', request.url)), csp)
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), csp)
  }

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('status,onboarding_complete,role').eq('id', user.id).maybeSingle()
    if (profile?.status === 'disabled') {
      await supabase.auth.signOut()
      return applySecurityHeaders(NextResponse.redirect(new URL('/login?error=disabled', request.url)), csp)
    }
    if (path.startsWith('/admin/') && path !== '/admin/login' && path !== '/admin/create-password' && profile?.role !== 'admin') return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), csp)
    if (!path.startsWith('/admin') && !path.startsWith('/api/admin') && !path.startsWith('/api/profile') && path !== '/account/setup' && profile?.role !== 'admin' && !profile?.onboarding_complete) return applySecurityHeaders(NextResponse.redirect(new URL('/account/setup', request.url)), csp)
  }

  if (user && path === '/account/setup') {
    const { data: profile } = await supabase.from('profiles').select('role,status,onboarding_complete').eq('id', user.id).maybeSingle()
    if (profile?.status === 'disabled') return applySecurityHeaders(NextResponse.redirect(new URL('/login?error=disabled', request.url)), csp)
    if (profile?.role === 'admin' || profile?.onboarding_complete) return applySecurityHeaders(NextResponse.redirect(new URL(profile?.role === 'admin' ? '/admin/dashboard' : '/dashboard', request.url)), csp)
  }

  return applySecurityHeaders(response, csp)
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'] }