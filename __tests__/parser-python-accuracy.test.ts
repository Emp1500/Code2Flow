import { codeToMermaid } from '@/lib/parser'

describe('fix 7: multi-line statements', () => {
  test('call split across lines renders as one node', () => {
    const out = codeToMermaid('result = compute(\n    alpha,\n    beta,\n)\nprint(result)', 'python')
    expect(out).toContain('result = compute( alpha, beta, )')
    expect(out).not.toContain('["alpha,"]')
  })
})

describe('fix 6: single-line suites', () => {
  test('inline if body is kept', () => {
    const out = codeToMermaid('x = 1\nif x > 0: print("positive")\nprint("done")', 'python')
    expect(out).toContain('x &gt; 0?')
    expect(out).toContain("print('positive')")
    expect(out).toContain('-->|Yes|')
  })

  test('semicolon-separated inline suite renders every statement', () => {
    const out = codeToMermaid('if flag: a(); b()', 'python')
    expect(out).toContain('["a()"]')
    expect(out).toContain('["b()"]')
  })

  test('colon inside a slice or string does not split the header', () => {
    const out = codeToMermaid('for x in d[1:5]:\n    print(x)', 'python')
    expect(out).toContain('x in d[1:5]?')
    expect(out).toContain('print(x)')
  })
})
