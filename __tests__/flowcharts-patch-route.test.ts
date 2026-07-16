import { PATCH } from '@/app/api/flowcharts/[id]/route'
import { createQueryMock } from './helpers/supabase-query-mock'

let flowchartsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: () => flowchartsQuery,
  })),
}))

function patchRequest(body: object) {
  return new Request('http://localhost/api/flowcharts/fc-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/flowcharts/[id]', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
  })

  it('returns 404 when the caller does not own the flowchart', async () => {
    flowchartsQuery.queueResult({ data: null, error: { code: 'PGRST116' } })

    const response = await PATCH(patchRequest({ title: 'New title' }), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(response.status).toBe(404)
  })

  it('scopes the update to the authenticated user', async () => {
    flowchartsQuery.queueResult({ data: { id: 'fc-1', title: 'New title' }, error: null })

    await PATCH(patchRequest({ title: 'New title' }), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(flowchartsQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
