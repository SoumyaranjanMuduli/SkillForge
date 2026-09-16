import { Resend } from 'resend'

// `resend` was a listed dependency with zero calls anywhere in the codebase — no email ever
// sent. This module is the actual integration. Like execution.ts and rate-limit.ts, it never
// throws into the caller: a notification failure (or missing API key) must never block the
// admin action (release/assign) that triggered it.

let client: Resend | null | undefined
function getClient(): Resend | null {
  if (client !== undefined) return client
  const key = process.env.RESEND_API_KEY
  client = key ? new Resend(key) : null
  if (!client) console.warn('[notifications] RESEND_API_KEY is not set; emails will be logged, not sent.')
  return client
}

const FROM = process.env.NOTIFICATIONS_FROM_EMAIL || 'SkillForge <notifications@skillforge.app>'
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

async function send(to: string | null | undefined, subject: string, html: string) {
  if (!to) return
  const c = getClient()
  if (!c) { console.warn('[notifications] RESEND_API_KEY is not configured; email skipped.'); return }
  try {
    await c.emails.send({ from: FROM, to, subject, html })
  } catch (err) {
    console.error('[notifications] Failed to send email', { subject, error: err instanceof Error ? err.message : 'unknown error' })
  }
}

export async function sendResultReleasedEmail(to: string | null | undefined, assessmentName: string, attemptId: string) {
  const url = `${APP_URL}/results/${attemptId}`
  await send(to, `Your results for ${assessmentName} are ready`, `<p>Your results for <strong>${escapeHtml(assessmentName)}</strong> have been released.</p><p><a href="${url}">View your results</a></p>`)
}

export async function sendAssessmentAssignedEmail(to: string | null | undefined, assessmentName: string, assessmentId: string) {
  const url = `${APP_URL}/assessment/${assessmentId}`
  await send(to, `New assessment assigned: ${assessmentName}`, `<p>You've been assigned a new assessment: <strong>${escapeHtml(assessmentName)}</strong>.</p><p><a href="${url}">Start now</a></p>`)
}
