import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Bound how long a request waits on Redis. On timeout Upstash resolves
// { success: true, reason: 'timeout' } — a fail-OPEN that checkRateLimit
// overrides to a deny below.
const timeout = 1000

export const saveLimit  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1m'), timeout })
export const shareLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1m'), timeout })

export async function checkRateLimit(limiter: Ratelimit, key: string) {
  try {
    const { success, reset, reason } = await limiter.limit(key)
    // Upstash fails open when Redis is unreachable (resolves success:true,
    // reason:'timeout'). Deny instead so the limit can't be bypassed by
    // inducing Redis latency.
    if (reason === 'timeout') return { success: false, retryAfter: 5 }
    return { success, retryAfter: Math.ceil((reset - Date.now()) / 1000) }
  } catch {
    // Redis errored — fail closed rather than letting the request through.
    return { success: false, retryAfter: 5 }
  }
}
