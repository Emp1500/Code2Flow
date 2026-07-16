import { PUT } from '@/app/api/flowcharts/[id]/route'
import { createQueryMock } from './helpers/supabase-query-mock'

jest.mock('@/lib/rate-limit', () => ({
  saveLimit: {},
  checkRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
}))

let flowchartsQuery: ReturnType<typeof createQueryMock>
let versionsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: (table: string) => (table === 'flowcharts' ? flowchartsQuery : versionsQuery),
  })),
}))

function putRequest(body: object) {
  return new Request('http://localhost/api/flowcharts/fc-1', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('PUT /api/flowcharts/[id]', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
    versionsQuery = createQueryMock()
  })

  it('returns 404 and skips all writes when the caller does not own the flowchart', async () => {
    flowchartsQuery.queueResult({ data: null, error: { code: 'PGRST116' } })

    const response = await PUT(putRequest({ code: 'x' }), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(response.status).toBe(404)
    expect(versionsQuery.insert).not.toHaveBeenCalled()
  })

  it('still returns 200 with the updated flowchart when pruning old versions fails', async () => {
    flowchartsQuery
      .queueResult({ data: { id: 'fc-1' }, error: null })                // ownership check
      .queueResult({ data: { id: 'fc-1', title: 'T' }, error: null })    // final reload

    versionsQuery
      .queueResult({ data: { version_number: 3 }, error: null })         // latest version lookup
      .queueResult({ data: null, error: null })                          // version insert
      .queueResult({ data: null, error: { message: 'boom' } })           // prune list lookup fails

    const response = await PUT(putRequest({ code: 'new code' }), { params: Promise.resolve({ id: 'fc-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ id: 'fc-1', title: 'T' })
  })
})
