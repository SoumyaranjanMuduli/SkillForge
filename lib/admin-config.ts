/** Server-only admin configuration. Never expose ADMIN_EMAIL to the browser. */
export function getAdminEmail() {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return value || null
}

export function isAuthorizedAdminEmail(email: string | null | undefined) {
  const configured = getAdminEmail()
  return Boolean(configured && email && email.trim().toLowerCase() === configured)
}

export function getAuthRedirectOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === 'https:' || url.hostname === 'localhost') return url.origin
    } catch { /* handled below */ }
  }
  if (process.env.NODE_ENV !== 'production') return new URL(request.url).origin
  throw new Error('NEXT_PUBLIC_APP_URL must be a valid HTTPS origin in production.')
}
