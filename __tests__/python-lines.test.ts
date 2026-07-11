import { toLogicalLines, topLevelIndexOf, splitTopLevel } from '@/lib/parser/python-lines'

describe('toLogicalLines', () => {
  test('joins bracket continuations into one logical line', () => {
    const out = toLogicalLines('result = compute(\n    alpha,\n    beta,\n)\nprint(result)')
    expect(out.map(l => l.text)).toEqual(['result = compute( alpha, beta, )', 'print(result)'])
    expect(out[0].indent).toBe(0)
    expect(out[0].lineNum).toBe(1)
  })

  test('joins backslash continuations', () => {
    const out = toLogicalLines('total = a + \\\n    b')
    expect(out.map(l => l.text)).toEqual(['total = a + b'])
  })

  test('strips comments outside strings only', () => {
    const out = toLogicalLines('x = "a # b"  # real comment\n# full-line comment\ny = 1')
    expect(out.map(l => l.text)).toEqual(['x = "a # b"', 'y = 1'])
  })

  test('brackets inside strings do not open continuations', () => {
    const out = toLogicalLines('msg = "if you see this: fine ("\nprint(msg)')
    expect(out).toHaveLength(2)
  })

  test('triple-quoted string spanning lines stays one logical line', () => {
    const out = toLogicalLines('doc = """line one\nline two"""\nprint(doc)')
    expect(out).toHaveLength(2)
    expect(out[0].text).toContain('line two')
  })

  test('unclosed bracket at EOF still flushes', () => {
    const out = toLogicalLines('x = f(\n    1,')
    expect(out).toHaveLength(1)
  })
})

describe('topLevelIndexOf / splitTopLevel', () => {
  test('skips colons inside brackets and strings', () => {
    expect(topLevelIndexOf('if d[1:2] and "a:b": pass', ':')).toBe(19)
    expect(topLevelIndexOf('x = 1', ':')).toBe(-1)
  })

  test('splits on top-level separators only', () => {
    expect(splitTopLevel('a(); b("x;y"); c()', ';')).toEqual(['a()', ' b("x;y")', ' c()'])
  })
})
