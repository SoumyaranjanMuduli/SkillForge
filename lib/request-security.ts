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

export function applySecurityHeaders(response: Response) {
  const scriptSources = process.env.NODE_ENV === 'development' ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'"
  const upgradeInsecureRequests = process.env.NODE_ENV === 'development' ? '' : '; upgrade-insecure-requests'
  response.headers.set('Content-Security-Policy', `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.upstash.io; worker-src 'self' blob:; manifest-src 'self'${upgradeInsecureRequests}`)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cache-Control', 'no-store')
  return response
}
