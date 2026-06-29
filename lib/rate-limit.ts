import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const saveLimit   = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1m') })
export const shareLimit  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1m') })
export const globalLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1m') })

export async function checkRateLimit(limiter: Ratelimit, key: string) {
  const { success, reset } = await limiter.limit(key)
  return { success, retryAfter: Math.ceil((reset - Date.now()) / 1000) }
}
