/* eslint-disable @typescript-eslint/no-explicit-any */
type QueryResult = { data: any; error: any }

export function createQueryMock() {
  const queue: QueryResult[] = []
  const mock: any = {
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    order: jest.fn(() => mock),
    limit: jest.fn(() => mock),
    in: jest.fn(() => mock),
    update: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    delete: jest.fn(() => mock),
    single: jest.fn(() => mock),
    queueResult(result: QueryResult) {
      queue.push(result)
      return mock
    },
    then(resolve: (value: QueryResult) => void) {
      resolve(queue.shift() ?? { data: null, error: null })
    },
  }
  return mock
}
