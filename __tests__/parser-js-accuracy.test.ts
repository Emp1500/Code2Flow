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
