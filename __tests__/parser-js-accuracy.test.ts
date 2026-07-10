import { codeToMermaid } from '@/lib/parser'

describe('fix 1: function-valued expressions render their bodies', () => {
  test('arrow function assigned to const', () => {
    const out = codeToMermaid('const add = (a, b) => {\n  if (a > b) return a\n  return b\n}', 'javascript')
    expect(out).toContain('(["const add = (a, b) =&gt;"])')
    expect(out).toContain('a &gt; b?')
    expect(out).toContain('(["end add"])')
  })

  test('function expression assigned to a property', () => {
    const out = codeToMermaid('obj.handler = function (e) {\n  if (e) log(e)\n}', 'javascript')
    expect(out).toContain('(["obj.handler = function(e)"])')
    expect(out).toContain('{"e?"}')
  })

  test('expression-bodied arrow stays a single process node', () => {
    const out = codeToMermaid('const double = x => x * 2', 'javascript')
    expect(out).not.toContain('end double')
  })

  test('mixed declaration keeps plain declarators and expands the function one', () => {
    const out = codeToMermaid('const limit = 5, check = (x) => {\n  return x < limit\n}', 'javascript')
    expect(out).toContain('["const limit = 5"]')
    expect(out).toContain('(["const check = (x) =&gt;"])')
  })
})

describe('fix 2: classes render members', () => {
  test('class with methods renders subroutine + method bodies', () => {
    const code = 'class Stack extends Base {\n  constructor() { super(); this.items = [] }\n  pop() {\n    if (this.items.length === 0) return null\n    return this.items.pop()\n  }\n}'
    const out = codeToMermaid(code, 'javascript')
    expect(out).toContain('class Stack extends Base')
    expect(out).toContain('(["constructor()"])')
    expect(out).toContain('(["pop()"])')
    expect(out).toContain('this.items.length === 0?')
    expect(out).not.toContain('ClassDeclaration')
  })

  test('class field renders as a process node', () => {
    const out = codeToMermaid('class A {\n  count = 0\n  reset() { this.count = 0 }\n}', 'javascript')
    expect(out).toContain('["count = 0"]')
    expect(out).toContain('(["reset()"])')
  })

  test('class expression assigned to const', () => {
    const out = codeToMermaid('const A = class {\n  go() { run() }\n}', 'javascript')
    expect(out).toContain('class A')
    expect(out).toContain('(["go()"])')
  })
})

describe('fix 3: switch no-match edge', () => {
  test('switch without default connects decision to merge', () => {
    const out = codeToMermaid('switch (x) {\n  case 1:\n    a()\n    break\n}\ndone()', 'javascript')
    expect(out).toContain('-->|no match|')
  })

  test('switch with default gets no extra edge', () => {
    const out = codeToMermaid('switch (x) {\n  case 1:\n    a()\n    break\n  default:\n    d()\n}', 'javascript')
    expect(out).not.toContain('no match')
  })
})
