import { z } from 'zod'

const responseSchema = z.object({
  ok: z.boolean(),
  stdout: z.string().max(100_000).optional(),
  stderr: z.string().max(20_000).optional(),
  result: z.unknown().optional(),
})

export type ExecutionRequest = {
  language: 'sql' | 'python'
  code: string
  dataset?: unknown
  tests?: unknown
  timeoutMs?: number
}

const MAX_RESPONSE_BYTES = 150_000

function normalizeTimeout(timeoutMs: number | undefined) {
  const value = Number(timeoutMs ?? 10_000)
  return Number.isFinite(value) ? Math.max(250, Math.min(30_000, Math.trunc(value))) : 10_000
}

function getExecutionUrl() {
  const raw = process.env.EXECUTION_API_URL?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (process.env.NODE_ENV === 'production') {
      if (url.protocol !== 'https:') return null
    } else if (!['http:', 'https:'].includes(url.protocol)) {
      return null
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export async function runIsolated(req: ExecutionRequest) {
  const url = getExecutionUrl()
  const key = process.env.EXECUTION_API_KEY
  if (!url || !key) return { ok: false, configured: false, stderr: 'Isolated execution service is not configured.' }

  const timeoutMs = normalizeTimeout(req.timeoutMs)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs + 1_000)

  try {
    const res = await fetch(`${url}/v1/execute`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ ...req, timeoutMs }),
      cache: 'no-store',
    })

    const len = Number(res.headers.get('content-length') ?? 0)
    if (Number.isFinite(len) && len > MAX_RESPONSE_BYTES) {
      return { ok: false, configured: true, stderr: 'Execution service returned an oversized response.' }
    }
    if (!res.ok) return { ok: false, configured: true, stderr: 'Execution service rejected the request.' }

    const raw = await res.text()
    if (raw.length > MAX_RESPONSE_BYTES) return { ok: false, configured: true, stderr: 'Execution service returned an oversized response.' }
    const parsed = responseSchema.safeParse(JSON.parse(raw))
    return parsed.success ? { ...parsed.data, configured: true } : { ok: false, configured: true, stderr: 'Invalid execution response.' }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { ok: false, configured: true, stderr: 'Execution service timed out.' }
    console.error('[execution] isolated execution request failed')
    return { ok: false, configured: true, stderr: 'Execution service unavailable.' }
  } finally {
    clearTimeout(timer)
  }
}
