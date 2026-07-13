import { GET } from '@/app/api/flowcharts/[id]/route'

const flowchartsQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
}
const versionsQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: (table: string) => (table === 'flowcharts' ? flowchartsQuery : versionsQuery),
  })),
}))

describe('GET /api/flowcharts/[id]', () => {
  it('issues the flowchart and version lookups concurrently', async () => {
    let flowchartResolved = false
    let versionStartedBeforeFlowchartResolved = false

    flowchartsQuery.single.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => {
            flowchartResolved = true
            resolve({ data: { id: 'fc-1', user_id: 'user-1' }, error: null })
          }, 20)
        )
    )
    versionsQuery.single.mockImplementation(() => {
      versionStartedBeforeFlowchartResolved = !flowchartResolved
      return Promise.resolve({ data: { code: 'x', version_number: 3 }, error: null })
    })

    const request = new Request('http://localhost/api/flowcharts/fc-1')
    const response = await GET(request, { params: Promise.resolve({ id: 'fc-1' }) })
    const body = await response.json()

    expect(versionStartedBeforeFlowchartResolved).toBe(true)
    expect(body).toMatchObject({ id: 'fc-1', code: 'x', version_number: 3 })
  })
})
