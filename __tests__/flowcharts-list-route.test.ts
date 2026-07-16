import { GET } from '@/app/api/flowcharts/route'
import { createQueryMock } from './helpers/supabase-query-mock'

let flowchartsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/rate-limit', () => ({
  saveLimit: {},
  checkRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: () => flowchartsQuery,
  })),
}))

describe('GET /api/flowcharts', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
  })

  it('caps the list query so a single user cannot load an unbounded number of rows', async () => {
    flowchartsQuery.queueResult({ data: [], error: null })

    await GET()

    expect(flowchartsQuery.limit).toHaveBeenCalledWith(100)
  })
})
