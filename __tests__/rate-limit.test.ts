// Keep the module import side-effect-free: the real Upstash clients need env
// vars at construction time, which aren't set under test.
jest.mock('@upstash/redis', () => ({ Redis: class {} }))
jest.mock('@upstash/ratelimit', () => {
  class Ratelimit {}
  ;(Ratelimit as unknown as { slidingWindow: () => object }).slidingWindow = () => ({})
  return { Ratelimit }
})

import { checkRateLimit } from '@/lib/rate-limit'
import type { Ratelimit } from '@upstash/ratelimit'

function limiterReturning(value: unknown): Ratelimit {
  return { limit: jest.fn(async () => value) } as unknown as Ratelimit
}

describe('checkRateLimit', () => {
  it('denies when Redis times out (Upstash fail-open override)', async () => {
    const limiter = limiterReturning({ success: true, reset: 0, reason: 'timeout' })

    const result = await checkRateLimit(limiter, 'user-1')

    expect(result.success).toBe(false)
  })

  it('denies when the limiter throws (Redis unreachable)', async () => {
    const limiter = { limit: jest.fn(async () => { throw new Error('ECONNREFUSED') }) } as unknown as Ratelimit

    const result = await checkRateLimit(limiter, 'user-1')

    expect(result.success).toBe(false)
  })

  it('allows a normal successful check', async () => {
    const limiter = limiterReturning({ success: true, reset: Date.now() + 60_000 })

    const result = await checkRateLimit(limiter, 'user-1')

    expect(result.success).toBe(true)
  })

  it('passes through a normal deny with a positive retryAfter', async () => {
    const limiter = limiterReturning({ success: false, reset: Date.now() + 30_000 })

    const result = await checkRateLimit(limiter, 'user-1')

    expect(result.success).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })
})
