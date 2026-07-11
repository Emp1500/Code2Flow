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

describe('fix 8 (parse): else attaches to the nearest preceding block', () => {
  test('else after try does not steal from an earlier if', () => {
    const code = 'if a:\n    one()\ntry:\n    risky()\nexcept:\n    handle()\nelse:\n    ok()'
    const out = codeToMermaid(code, 'python')
    const aCond = out.match(/(N\d+)\{"a\?"\}/)?.[1]
    const okId  = out.match(/(N\d+)\["ok\(\)"\]/)?.[1]
    expect(okId).toBeTruthy()
    // the if's No edge must not lead to ok()
    expect(out).not.toContain(`${aCond} -->|No| ${okId}`)
  })
})

describe('fix 8 (render): try/except/else', () => {
  test('else block runs after try body succeeds', () => {
    const code = 'try:\n    risky()\nexcept ValueError:\n    handle()\nelse:\n    celebrate()\nprint("done")'
    const out = codeToMermaid(code, 'python')
    const riskyId = out.match(/(N\d+)\["risky\(\)"\]/)?.[1]
    const celebId = out.match(/(N\d+)\["celebrate\(\)"\]/)?.[1]
    expect(celebId).toBeTruthy()
    expect(out).toContain(`${riskyId} --> ${celebId}`)
  })
})

describe('fix 5 (python): raise routes to except', () => {
  test('raise inside try connects to the first except node', () => {
    const code = 'try:\n    if bad:\n        raise ValueError("x")\n    ok()\nexcept ValueError:\n    handle()'
    const out = codeToMermaid(code, 'python')
    const raiseId = out.match(/(N\d+)\["raise ValueError\('x'\)"\]/)?.[1]
    const exceptId = out.match(/(N\d+)\(\["except ValueError"\]\)/)?.[1]
    expect(raiseId).toBeTruthy()
    expect(exceptId).toBeTruthy()
    expect(out).toContain(`${raiseId} --> ${exceptId}`)
  })

  test('raise with no enclosing try stays terminal', () => {
    const out = codeToMermaid('raise RuntimeError("boom")', 'python')
    const raiseId = out.match(/(N\d+)\["raise RuntimeError\('boom'\)"\]/)?.[1]
    expect(out).not.toMatch(new RegExp(`${raiseId} --> `))
  })
})
