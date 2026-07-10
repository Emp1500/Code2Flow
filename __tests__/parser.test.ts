import { codeToMermaid } from '@/lib/parser'

describe('JavaScript parser', () => {
  test('if statement produces Yes/No branches', () => {
    const out = codeToMermaid('if (x > 0) { return 1; } else { return 0; }', 'javascript')
    expect(out).toContain('-->|Yes|')
    expect(out).toContain('-->|No|')
  })

  test('for loop produces condition diamond', () => {
    const out = codeToMermaid('for (let i = 0; i < 5; i++) { console.log(i); }', 'javascript')
    expect(out).toContain('{')
    expect(out).toContain('-->|Yes|')
    expect(out).toContain('-->|No|')
  })

  test('while loop loops back to condition', () => {
    const out = codeToMermaid('while (true) { break; }', 'javascript')
    expect(out).toContain('-->|Yes|')
  })

  test('function declaration creates subroutine node', () => {
    const out = codeToMermaid('function greet(name) { return name; }', 'javascript')
    expect(out).toContain('(["function greet(name)"])')
  })

  test('Start and End nodes always present', () => {
    const out = codeToMermaid('const x = 1', 'javascript')
    expect(out).toContain('"Start"')
    expect(out).toContain('"End"')
  })

  test('if/else where both branches return leaves no disconnected merge node', () => {
    const out = codeToMermaid('if (x > 0) { return 1; } else { return 0; }', 'javascript')
    // every node id used as an edge target must also appear as an edge source or a leaf is fine,
    // but no node should be defined and then only ever be an edge *source* with zero incoming edges
    // other than Start. A dangling merge circle shows up as e.g. `N3(( ))` with an outgoing-only edge.
    expect(out).not.toMatch(/N\d+\(\( \)\)/)
  })
})

describe('Python parser', () => {
  test('if/elif/else chain', () => {
    const code = `if x > 0:\n    return 1\nelif x == 0:\n    return 0\nelse:\n    return -1`
    const out  = codeToMermaid(code, 'python')
    expect(out).toContain('-->|Yes|')
    expect(out).toContain('-->|No|')
  })

  test('for loop', () => {
    const code = `for i in range(5):\n    print(i)`
    const out  = codeToMermaid(code, 'python')
    expect(out).toContain('i in range(5)?')
  })

  test('try/except/finally', () => {
    const code = `try:\n    x = 1\nexcept ValueError:\n    pass\nfinally:\n    cleanup()`
    const out  = codeToMermaid(code, 'python')
    expect(out).toContain('try')
    expect(out).toContain('except ValueError')
    expect(out).toContain('finally')
  })

  test('if/elif/else chain where every branch returns leaves no disconnected merge node', () => {
    const code = `if x > 0:\n    return 1\nelif x == 0:\n    return 0\nelse:\n    return -1`
    const out  = codeToMermaid(code, 'python')
    expect(out).not.toMatch(/N\d+\(\( \)\)/)
  })
})

describe('TypeScript parser', () => {
  test('typed function with type annotations parses without throwing', () => {
    const out = codeToMermaid('function greet(name: string): string { return name; }', 'typescript')
    expect(out).toContain('(["function greet(name)"])')
  })

  test('interface and type alias declarations do not appear as nodes', () => {
    const code = `interface User { name: string }\ntype Pair<T> = [T, T]\nfunction f(): void {}`
    const out  = codeToMermaid(code, 'typescript')
    expect(out).not.toContain('TSInterfaceDeclaration')
    expect(out).not.toContain('TSTypeAliasDeclaration')
  })

  test('exported function still renders its body', () => {
    const code = `export function greet(name: string): string {\n  if (!name) return "hi"\n  return name\n}`
    const out  = codeToMermaid(code, 'typescript')
    expect(out).toContain('-->|Yes|')
    expect(out).toContain('-->|No|')
  })
})
