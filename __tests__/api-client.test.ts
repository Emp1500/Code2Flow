import { fetchFlowchart, ApiError } from '@/lib/api-client'

describe('api-client error handling', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    jest.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('throws an ApiError with the server message when the response is not ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 })
    )

    await expect(fetchFlowchart('fc-1')).rejects.toMatchObject({
      message: 'Rate limit exceeded',
      status: 429,
    })
  })

  it('throws a fallback ApiError when the error response has no JSON body', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('not json', { status: 500 }))

    await expect(fetchFlowchart('fc-1')).rejects.toBeInstanceOf(ApiError)
    await expect(fetchFlowchart('fc-1')).rejects.toMatchObject({ status: 500 })
  })

  it('resolves with the parsed JSON when the response is ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'fc-1', code: 'x' }), { status: 200 })
    )

    await expect(fetchFlowchart('fc-1')).resolves.toMatchObject({ id: 'fc-1', code: 'x' })
  })
})
