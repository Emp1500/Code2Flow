import { codeToMermaid } from '@/lib/parser'

describe('fix 7: multi-line statements', () => {
  test('call split across lines renders as one node', () => {
    const out = codeToMermaid('result = compute(\n    alpha,\n    beta,\n)\nprint(result)', 'python')
    expect(out).toContain('result = compute( alpha, beta, )')
    expect(out).not.toContain('["alpha,"]')
  })
})
