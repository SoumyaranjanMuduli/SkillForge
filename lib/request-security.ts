export function isTrustedMutationRequest(request: Request) {
  const method = request.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const trusted = new Set<string>()
  try {
    trusted.add(new URL(request.url).origin)
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
    if (configured) trusted.add(new URL(configured).origin)
  } catch {
    return false
  }
  if (origin && trusted.has(origin)) return true
  if (!origin && referer) {
    try { return trusted.has(new URL(referer).origin) } catch { return false }
  }
  return false
}

// Next.js's App Router injects an inline <script> on every page (the
// `self.__next_f.push(...)` RSC-hydration payload). A `script-src 'self'`
// CSP with no nonce silently blocks that script in production — the page
// never hydrates and renders blank. Dev mode masked this because it falls
// back to 'unsafe-inline'. Fix: a per-request nonce, forwarded to the app
// via the request's own CSP header so Next can stamp its inline scripts
// with it (this is Next's documented nonce recipe), and echoed on the
// response so the browser enforces the same policy.
export function buildCspHeader(nonce: string) {
  const isDev = process.env.NODE_ENV === 'development'
  // 'strict-dynamic' lets scripts loaded by a nonced script run too, without
  // needing to allowlist every host. Dev still needs 'unsafe-eval' for HMR.
  const scriptSources = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`
  const upgradeInsecureRequests = isDev ? '' : '; upgrade-insecure-requests'
  return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.upstash.io; worker-src 'self' blob:; manifest-src 'self'${upgradeInsecureRequests}`
}

export function applySecurityHeaders(response: Response, csp: string) {
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cache-Control', 'no-store')
  return response
}