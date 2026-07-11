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

describe('fix 9: while-else', () => {
  test('else body renders on the No path', () => {
    const code = 'while cond():\n    work()\nelse:\n    cleanup()\nprint("done")'
    const out = codeToMermaid(code, 'python')
    const condId = out.match(/(N\d+)\{"cond\(\)\?"\}/)?.[1]
    const cleanId = out.match(/(N\d+)\["cleanup\(\)"\]/)?.[1]
    expect(cleanId).toBeTruthy()
    expect(out).toContain(`${condId} -->|No| ${cleanId}`)
  })
})

describe('fix 10: async constructs', () => {
  test('async def renders its body with async label', () => {
    const code = 'async def fetch(url):\n    if not url:\n        return None\n    return await get(url)'
    const out = codeToMermaid(code, 'python')
    expect(out).toContain('async def fetch(url)')
    expect(out).toContain('not url?')
    // body must nest inside the def: return routes to the function end node
    const retId = out.match(/(N\d+)\["return None"\]/)?.[1]
    const endId = out.match(/(N\d+)\(\["end fetch"\]\)/)?.[1]
    expect(out).toContain(`${retId} --> ${endId}`)
  })

  test('async with and async for parse as blocks', () => {
    const code = 'async def main():\n    async with session() as s:\n        async for item in s.stream():\n            handle(item)'
    const out = codeToMermaid(code, 'python')
    expect(out).toContain('async with session() as s')
    expect(out).toContain('item in s.stream()?')
    expect(out).toContain('handle(item)')
  })

  test('def with return annotation parses', () => {
    const code = 'def size(x) -> int:\n    return len(x)'
    const out = codeToMermaid(code, 'python')
    expect(out).toContain('def size(x)')
    expect(out).toContain('return len(x)')
  })
})
