import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

let limiter: Ratelimit | null = null
let warnedMissingConfig = false

function getLimiter() {
  if (limiter) return limiter
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Production assessment mutations must not run without a real rate limiter.
    if (!warnedMissingConfig) {
      warnedMissingConfig = true
      console.error('[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set.' + (process.env.NODE_ENV === 'production' ? ' Production requests will be rejected until Redis is configured.' : ' Development requests will run without rate limiting.'))
    }
    return null
  }
  limiter = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(60, '1 m'), analytics: true, prefix: 'skillforge' })
  return limiter
}

export async function enforceRateLimit(key: string) {
  const l = getLimiter()
  if (!l) return process.env.NODE_ENV !== 'production'
  try {
    return (await l.limit(key)).success
  } catch (err) {
    console.error('[rate-limit] Upstash request failed.', err)
    return process.env.NODE_ENV !== 'production'
  }
}
