import { POST } from '@/app/api/flowcharts/[id]/share/route'
import { createQueryMock } from './helpers/supabase-query-mock'

jest.mock('@/lib/rate-limit', () => ({
  shareLimit: {},
  checkRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
}))
jest.mock('@/lib/share', () => ({ generateShareId: () => 'share-xyz' }))

let flowchartsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: () => flowchartsQuery,
  })),
}))

function shareRequest() {
  return new Request('http://localhost/api/flowcharts/fc-1/share', { method: 'POST' })
}

describe('POST /api/flowcharts/[id]/share', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
  })

  it('returns 404 when the caller does not own the flowchart', async () => {
    flowchartsQuery.queueResult({ data: null, error: { code: 'PGRST116' } })

    const response = await POST(shareRequest(), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(response.status).toBe(404)
  })

  it('scopes both the read and the update to the authenticated user', async () => {
    flowchartsQuery
      .queueResult({ data: { is_public: false, share_id: null }, error: null })
      .queueResult({ data: { is_public: true, share_id: 'share-xyz' }, error: null })

    await POST(shareRequest(), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(flowchartsQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
