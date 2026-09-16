export function friendlyAuthError(message: string, fallback = 'Something went wrong. Please try again.') {
  const value = message.toLowerCase()
  if (value.includes('rate limit') || value.includes('too many') || value.includes('429') || value.includes('over_email_send_rate_limit')) {
    return 'Too many requests. Please wait a few minutes and try again.'
  }
  if (value.includes('redirect') || value.includes('redirect_to') || value.includes('site url')) {
    return 'Authentication redirect is not configured for this environment.'
  }
  if (value.includes('email not confirmed') || value.includes('email_not_confirmed')) {
    return 'Please verify your email before signing in.'
  }
  if (value.includes('invalid login credentials')) return 'Email or password is incorrect.'
  if (value.includes('password')) return message
  return fallback
}
