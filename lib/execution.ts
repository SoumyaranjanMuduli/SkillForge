import { z } from 'zod'

const responseSchema = z.object({ ok: z.boolean(), stdout: z.string().optional(), stderr: z.string().optional(), result: z.unknown().optional() })

export type ExecutionRequest = {
  language: 'sql' | 'python'
  code: string
  dataset?: unknown
  tests?: unknown
  timeoutMs?: number
}

export async function runIsolated(req: ExecutionRequest) {
  const url = process.env.EXECUTION_API_URL
  const key = process.env.EXECUTION_API_KEY
  if (!url || !key) return { ok:false, configured:false, stderr:'Isolated execution service is not configured.' }
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), Math.min(req.timeoutMs ?? 10_000, 30_000))
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/v1/execute`, {
      method:'POST', signal:ctrl.signal, headers:{'content-type':'application/json','authorization':`Bearer ${key}`},
      body:JSON.stringify(req), cache:'no-store'
    })
    if (!res.ok) return { ok:false, configured:true, stderr:'Execution service rejected the request.' }
    const parsed = responseSchema.safeParse(await res.json())
    return parsed.success ? { ...parsed.data, configured:true } : { ok:false, configured:true, stderr:'Invalid execution response.' }
  } catch {
    return { ok:false, configured:true, stderr:'Execution service unavailable.' }
  } finally { clearTimeout(timeout) }
}
