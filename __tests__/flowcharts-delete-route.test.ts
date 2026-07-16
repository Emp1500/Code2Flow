import { DELETE } from '@/app/api/flowcharts/[id]/route'
import { createQueryMock } from './helpers/supabase-query-mock'

let flowchartsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: () => flowchartsQuery,
  })),
}))

describe('DELETE /api/flowcharts/[id]', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
  })

  it('returns 404 when the caller does not own the flowchart', async () => {
    flowchartsQuery.queueResult({ data: null, error: { code: 'PGRST116' } })

    const response = await DELETE(
      new Request('http://localhost/api/flowcharts/fc-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'fc-1' }) }
    )

    expect(response.status).toBe(404)
  })

  it('deletes and returns success when the caller owns the flowchart', async () => {
    flowchartsQuery.queueResult({ data: { id: 'fc-1' }, error: null })

    const response = await DELETE(
      new Request('http://localhost/api/flowcharts/fc-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'fc-1' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(flowchartsQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
