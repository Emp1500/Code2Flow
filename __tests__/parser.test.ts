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
})
