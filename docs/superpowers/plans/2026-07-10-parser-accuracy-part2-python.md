# Parser Accuracy Part 2 (Python) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 confirmed Python conversion-accuracy defects plus the Python half of throw-routing (spec: `docs/superpowers/specs/2026-07-10-parser-accuracy-design.md` fixes 5–10).

**Architecture:** Add a logical-line scanner (`python-lines.ts`) that joins bracket/backslash/triple-quote continuations and strips comments; restructure `parsePython` to split inline suites at the top-level colon and to attach `else`/`elif` to the **last** statement of the parent block; rework `processTry` for `try/else` and raise-routing.

**Tech Stack:** TypeScript, jest (`npx jest`). Tests import via `@/lib/parser`.

## Global Constraints

- **Requires Part 1 complete** — `TraversalContext.throwTarget` (added in Part 1 Task 5) is consumed here.
- No new dependencies.
- Only touch: `lib/parser/python.ts`, new `lib/parser/python-lines.ts`, new test files `__tests__/python-lines.test.ts`, `__tests__/parser-python-accuracy.test.ts`.
- `convertPython` must never throw: the scanner is total — unclosed brackets/strings at EOF flush the pending logical line as-is.
- Existing tests must keep passing (`npx jest`).
- Mermaid labels are escaped by `converter.ts` (`>` → `&gt;`, `"` → `'`) — test expectations must use the escaped form.
- Commit messages: conventional style, **no Co-Authored-By trailer**.

---

### Task 1: Logical-line scanner (fix 7)

**Files:**
- Create: `lib/parser/python-lines.ts`
- Modify: `lib/parser/python.ts` (delete its local `getIndent`, import from `./python-lines`; rewrite `parsePython`'s line loop)
- Test: `__tests__/python-lines.test.ts` (create), `__tests__/parser-python-accuracy.test.ts` (create)

**Interfaces:**
- Produces (all exported from `lib/parser/python-lines.ts`; Tasks 2+ consume them):
  - `interface LogicalLine { text: string; indent: number; lineNum: number }`
  - `toLogicalLines(code: string): LogicalLine[]`
  - `topLevelIndexOf(text: string, target: string, from?: number): number`
  - `splitTopLevel(text: string, sep: string): string[]`
  - `getIndent(line: string): number` (moved verbatim from python.ts)

- [ ] **Step 1: Write the failing tests**

Create `__tests__/python-lines.test.ts`:

```ts
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
```

Create `__tests__/parser-python-accuracy.test.ts`:

```ts
import { codeToMermaid } from '@/lib/parser'

describe('fix 7: multi-line statements', () => {
  test('call split across lines renders as one node', () => {
    const out = codeToMermaid('result = compute(\n    alpha,\n    beta,\n)\nprint(result)', 'python')
    expect(out).toContain('result = compute( alpha, beta, )')
    expect(out).not.toContain('["alpha,"]')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/python-lines.test.ts __tests__/parser-python-accuracy.test.ts`
Expected: python-lines suite fails at import (module doesn't exist); accuracy test fails with four separate boxes.

- [ ] **Step 3: Implement the scanner**

Create `lib/parser/python-lines.ts`:

```ts
export interface LogicalLine { text: string; indent: number; lineNum: number }

export function getIndent(line: string): number {
  let n = 0
  for (const c of line) { if (c === ' ') n++; else if (c === '\t') n += 4; else break }
  return n
}

/**
 * Joins physical lines into logical lines: open brackets, trailing-backslash
 * continuations, and triple-quoted strings all continue onto the next line.
 * Comments are stripped only outside strings. Total: unclosed state at EOF
 * flushes the pending logical line instead of erroring.
 */
export function toLogicalLines(code: string): LogicalLine[] {
  const physical = code.split('\n')
  const out: LogicalLine[] = []
  let buf: string[] = []
  let indent = 0
  let lineNum = 0
  let depth = 0
  let str: string | null = null // open string delimiter: ', ", ''' or """

  const flush = () => {
    const text = buf.join(' ').trim()
    if (text) out.push({ text, indent, lineNum })
    buf = []
  }

  for (let i = 0; i < physical.length; i++) {
    const raw = physical[i]
    if (buf.length === 0 && str === null) {
      if (!raw.trim() || raw.trim().startsWith('#')) continue
      indent = getIndent(raw)
      lineNum = i + 1
    }

    let piece = ''
    for (let j = 0; j < raw.length; j++) {
      const c = raw[j]
      if (str !== null) {
        piece += c
        if (str.length === 3) {
          if (raw.startsWith(str, j)) { piece += str.slice(1); j += 2; str = null }
        } else if (c === '\\') { piece += raw[j + 1] ?? ''; j++ }
        else if (c === str) str = null
        continue
      }
      if (c === '#') break
      if (c === "'" || c === '"') {
        if (raw.startsWith(c.repeat(3), j)) { str = c.repeat(3); piece += str; j += 2 }
        else { str = c; piece += c }
        continue
      }
      if ('([{'.includes(c)) depth++
      else if (')]}'.includes(c)) depth = Math.max(0, depth - 1)
      piece += c
    }

    // a single-quoted string cannot span physical lines — recover
    if (str !== null && str.length === 1) str = null

    const continued = piece.trimEnd().endsWith('\\')
    buf.push((continued ? piece.trimEnd().slice(0, -1) : piece).trim())

    if (depth === 0 && str === null && !continued) flush()
  }
  flush()
  return out
}

/** Index of the first `target` char at bracket-depth 0 outside strings, at or after `from`. */
export function topLevelIndexOf(text: string, target: string, from = 0): number {
  let depth = 0
  let str: string | null = null
  for (let j = 0; j < text.length; j++) {
    const c = text[j]
    if (str !== null) {
      if (str.length === 3) { if (text.startsWith(str, j)) { j += 2; str = null } }
      else if (c === '\\') j++
      else if (c === str) str = null
      continue
    }
    if (c === "'" || c === '"') { str = text.startsWith(c.repeat(3), j) ? c.repeat(3) : c; if (str.length === 3) j += 2; continue }
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth = Math.max(0, depth - 1)
    else if (c === target && depth === 0 && j >= from) return j
  }
  return -1
}

/** Splits on `sep` occurring at bracket-depth 0 outside strings; drops empty parts. */
export function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = []
  let start = 0
  let idx = topLevelIndexOf(text, sep, 0)
  while (idx !== -1) {
    parts.push(text.slice(start, idx))
    start = idx + 1
    idx = topLevelIndexOf(text, sep, start)
  }
  parts.push(text.slice(start))
  return parts.filter(p => p.trim())
}
```

In `lib/parser/python.ts`: delete the local `getIndent`, add `import { toLogicalLines } from './python-lines'` (Task 2 extends this import with `topLevelIndexOf, splitTopLevel`), and rewrite the loop head of `parsePython` — everything from `const lines = code.split('\n')` through the `const indent = getIndent(raw)` line becomes:

```ts
export function parsePython(code: string): PyNode {
  const ast: PyNode = { type: 'Program', body: [] }
  const stack: Array<{ indent: number; node: PyNode; type: string }> = [{ indent: -1, node: ast, type: 'program' }]

  for (const ll of toLogicalLines(code)) {
    const trimmed = ll.text
    const indent = ll.indent

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1]
    const node = parseLine(trimmed, ll.lineNum)
    if (!node) continue
    // ... rest of the loop body unchanged ...
```

(The rest of the loop — elif/else attach, except/finally attach, case attach, push — is unchanged in this task; `trimmed.endsWith(':')` still gates block-opening.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/python-lines.test.ts __tests__/parser-python-accuracy.test.ts __tests__/parser.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/parser/python-lines.ts lib/parser/python.ts __tests__/python-lines.test.ts __tests__/parser-python-accuracy.test.ts
git commit -m "fix(parser): join Python physical lines into logical lines before parsing"
```

---

### Task 2: Inline suites + last-statement else/elif attachment (fixes 6 + 8 parse half)

**Files:**
- Modify: `lib/parser/python.ts` (`parsePython`)
- Test: `__tests__/parser-python-accuracy.test.ts`

**Interfaces:**
- Consumes: `topLevelIndexOf`, `splitTopLevel` from Task 1.
- Produces: `Try` PyNodes may now carry `elsebody: PyNode | null` (rendered in Task 3).

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/parser-python-accuracy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/parser-python-accuracy.test.ts -t "fix 6"`
Expected: FAIL — `print('positive')` missing (inline body dropped). The fix-8 test may pass or fail depending on current misattachment; keep it regardless.

- [ ] **Step 3: Implement**

Rewrite `parsePython` in `lib/parser/python.ts`:

```ts
const COMPOUND = /^(if|elif|else|for|while|def|class|try|except|finally|with|match|case)\b/

export function parsePython(code: string): PyNode {
  const ast: PyNode = { type: 'Program', body: [] }
  const stack: Array<{ indent: number; node: PyNode; type: string }> = [{ indent: -1, node: ast, type: 'program' }]

  for (const ll of toLogicalLines(code)) {
    const trimmed = ll.text
    const indent = ll.indent

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1]

    let node: PyNode | null
    let isBlock = false
    if (COMPOUND.test(trimmed)) {
      const ci = topLevelIndexOf(trimmed, ':')
      if (ci !== -1 && ci < trimmed.length - 1) {
        // inline suite: `if x: f(); g()` — parse header and remainder separately
        node = parseLine(trimmed.slice(0, ci + 1), ll.lineNum)
        const rest = trimmed.slice(ci + 1).trim()
        if (node && rest) {
          node.body = splitTopLevel(rest, ';')
            .map(s => parseLine(s.trim(), ll.lineNum))
            .filter((n): n is PyNode => !!n)
        }
      } else {
        node = parseLine(trimmed, ll.lineNum)
        isBlock = ci !== -1 // header with nothing after the colon opens a block
      }
    } else {
      node = parseLine(trimmed, ll.lineNum)
    }
    if (!node) continue

    // Attach elif/else to the LAST statement of the parent block only
    if (node.type === 'Elif' || node.type === 'Else') {
      const body = parent.node.body ?? []
      const last = body[body.length - 1]
      if (last && node.type === 'Elif' && last.type === 'If') {
        const nested: PyNode = { type: 'If', test: node.test, body: node.body ?? [], orelse: [] }
        const tail = getLastIf(last)
        tail.orelse = tail.orelse ?? []
        tail.orelse.push(nested)
        if (isBlock) stack.push({ indent, node: nested, type: 'If' })
        continue
      }
      if (last && node.type === 'Else') {
        if (last.type === 'For' || last.type === 'While') last.orelse = node
        else if (last.type === 'Try') last.elsebody = node
        else if (last.type === 'If') { const tail = getLastIf(last); tail._elseNode = node }
        else { continue } // stray else — drop
        if (isBlock) stack.push({ indent, node, type: 'Else' })
        continue
      }
      continue // stray elif/else with no preceding block — drop
    }

    // Attach except/finally to most recent try
    if (node.type === 'ExceptHandler' || node.type === 'Finally') {
      const body = parent.node.body ?? []
      const tryNode = [...body].reverse().find((n: PyNode) => n.type === 'Try')
      if (tryNode) {
        if (node.type === 'ExceptHandler') tryNode.handlers.push(node)
        else tryNode.finalbody = node
        if (isBlock) stack.push({ indent, node, type: node.type })
        continue
      }
    }

    // Attach case to most recent match
    if (node.type === 'Case') {
      const body = parent.node.body ?? []
      const matchNode = [...body].reverse().find((n: PyNode) => n.type === 'Match')
      if (matchNode) {
        matchNode.cases.push(node)
        if (isBlock) stack.push({ indent, node, type: 'Case' })
        continue
      }
    }

    parent.node.body = parent.node.body ?? []
    parent.node.body.push(node)
    if (isBlock) stack.push({ indent, node, type: node.type })
  }

  return ast
}
```

Notes:
- `COMPOUND` uses `\b`, so `match = 5` or `case_count = 1` fall through to the plain-expression path (`topLevelIndexOf` returns -1 for them anyway).
- `parseLine` itself is unchanged — headers passed to it still end with `:` so its regexes match.
- The Elif branch also works for inline `elif b: two()` because `node.body` was filled before attachment.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/parser-python-accuracy.test.ts __tests__/parser.test.ts`
Expected: all PASS (the existing if/elif/else and try tests exercise the rewritten attach logic).

- [ ] **Step 5: Commit**

```bash
git add lib/parser/python.ts __tests__/parser-python-accuracy.test.ts
git commit -m "fix(parser): parse Python inline suites and fix else/elif attachment"
```

---

### Task 3: `try/else` rendering + raise routes to except (fixes 8 render + 5 Python half)

**Files:**
- Modify: `lib/parser/python.ts` (`processTry` ~line 224, `processRaise` ~line 295, `processFunction` ~line 149)
- Test: `__tests__/parser-python-accuracy.test.ts`

**Interfaces:**
- Consumes: `TraversalContext.throwTarget` (Part 1 Task 5) and `Try.elsebody` (Task 2).

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/parser-python-accuracy.test.ts -t "fix 8 (render)"` and `-t "fix 5 (python)"`
Expected: FAIL — `celebrate()` absent; raise node has no outgoing edge.

- [ ] **Step 3: Implement**

Replace `processTry` in `lib/parser/python.ts` — handler nodes are created **before** the try body so raises can route to them; `elsebody` renders on the success path:

```ts
function processTry(node: PyNode, ctx: TraversalContext): BlockResult {
  const tryNode = ctx.graph.createNode('process', 'try', 'rounded')
  const after   = ctx.graph.createNode('merge' as any, '', 'circle')

  const handlerNodes: FlowchartNode[] = []
  for (const h of (node.handlers ?? [])) {
    const label = h.exceptionType ? (h.name ? `except ${h.exceptionType} as ${h.name}` : `except ${h.exceptionType}`) : 'except'
    const catchN = ctx.graph.createNode('process', label, 'rounded')
    ctx.graph.connect(tryNode, catchN, 'error')
    handlerNodes.push(catchN)
  }
  const finallyNode: FlowchartNode | null = node.finalbody?.body
    ? ctx.graph.createNode('process', 'finally', 'rounded')
    : null

  const tCtx = ctx.clone(); tCtx.currentNode = tryNode
  tCtx.throwTarget = handlerNodes[0] ?? finallyNode
  const tRes = processBlock(node.body ?? [], tCtx)
  if (tRes.entry) ctx.graph.connect(tryNode, tRes.entry)

  if (finallyNode) {
    const fCtx = ctx.clone(); fCtx.currentNode = finallyNode
    const fRes = processBlock(node.finalbody!.body, fCtx)
    if (fRes.entry) ctx.graph.connect(finallyNode, fRes.entry)
    ctx.graph.connect(fRes.exit ?? finallyNode, after)
  }

  const target = finallyNode ?? after

  // try/else runs only when the try body completed without raising
  let successExit = tRes.exit
  if (node.elsebody && successExit) {
    const eCtx = ctx.clone(); eCtx.currentNode = null
    const eRes = processBlock(node.elsebody.body ?? [], eCtx)
    if (eRes.entry) { ctx.graph.connect(successExit, eRes.entry); successExit = eRes.exit }
  }
  if (successExit) ctx.graph.connect(successExit, target)

  for (let i = 0; i < handlerNodes.length; i++) {
    const h = (node.handlers ?? [])[i]
    const cCtx = ctx.clone(); cCtx.currentNode = handlerNodes[i]
    const cRes = processBlock(h.body ?? [], cCtx)
    if (cRes.entry) ctx.graph.connect(handlerNodes[i], cRes.entry)
    ctx.graph.connect(cRes.exit ?? handlerNodes[i], target)
  }

  return { entry: tryNode, exit: after }
}
```

Replace `processRaise`:

```ts
function processRaise(node: PyNode, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', node.exception ? `raise ${node.exception}` : 'raise', 'rectangle')
  if (ctx.throwTarget) ctx.graph.connect(n, ctx.throwTarget)
  return { entry: n, exit: null }
}
```

In `processFunction`, after `fCtx.returnTarget = end` add function-boundary resets (matching Part 1):

```ts
fCtx.breakTarget = null; fCtx.continueTarget = null; fCtx.throwTarget = null
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/parser-python-accuracy.test.ts __tests__/parser.test.ts`
Expected: all PASS (existing try/except/finally test asserts labels only).

- [ ] **Step 5: Commit**

```bash
git add lib/parser/python.ts __tests__/parser-python-accuracy.test.ts
git commit -m "fix(parser): render Python try/else and route raise to except"
```

---

### Task 4: `while ... else` renders (fix 9)

**Files:**
- Modify: `lib/parser/python.ts` (`processWhile` ~line 214)
- Test: `__tests__/parser-python-accuracy.test.ts`

**Interfaces:** none new (`While.orelse` already attached by `parsePython`).

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/parser-python-accuracy.test.ts -t "fix 9"`
Expected: FAIL — `cleanup()` absent.

- [ ] **Step 3: Implement**

In `processWhile`, replace the unconditional `ctx.graph.connect(cond, after, 'No')` with the same `orelse` handling `processFor` already has:

```ts
if (node.orelse?.body?.length) {
  const eCtx = ctx.clone(); eCtx.currentNode = null
  const eRes = processBlock(node.orelse.body, eCtx)
  if (eRes.entry) { ctx.graph.connect(cond, eRes.entry, 'No'); if (eRes.exit) ctx.graph.connect(eRes.exit, after) }
  else ctx.graph.connect(cond, after, 'No')
} else ctx.graph.connect(cond, after, 'No')
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/parser-python-accuracy.test.ts __tests__/parser.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/parser/python.ts __tests__/parser-python-accuracy.test.ts
git commit -m "fix(parser): render Python while-else body"
```

---

### Task 5: `async def` / `async for` / `async with` + def return annotations (fix 10)

**Files:**
- Modify: `lib/parser/python.ts` (`parseLine` ~line 14, `processFunction`, `processWith`)
- Test: `__tests__/parser-python-accuracy.test.ts`

**Interfaces:** `PyNode` gains optional `isAsync?: boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('fix 10: async constructs', () => {
  test('async def renders its body with async label', () => {
    const code = 'async def fetch(url):\n    if not url:\n        return None\n    return await get(url)'
    const out = codeToMermaid(code, 'python')
    expect(out).toContain('async def fetch(url)')
    expect(out).toContain('not url?')
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/parser-python-accuracy.test.ts -t "fix 10"`
Expected: FAIL — async lines and annotated defs fall through to plain `Expr` boxes; bodies flatten.

- [ ] **Step 3: Implement**

In `parseLine`, add as the **first** check (before the `def` regex):

```ts
if (line.startsWith('async ')) {
  const node = parseLine(line.slice(6).trim(), lineNum)
  if (node && (node.type === 'FunctionDef' || node.type === 'For' || node.type === 'With')) node.isAsync = true
  return node
}
```

Change the `def` regex to tolerate a return annotation:

```ts
if ((m = line.match(/^def\s+(\w+)\s*\((.*?)\)\s*(?:->\s*[^:]+)?:/)))
```

In `processFunction`, change the label line to:

```ts
const fn = ctx.graph.createNode('subroutine', `${node.isAsync ? 'async ' : ''}def ${node.name}(${node.params})`, 'rounded')
```

In `processWith`, change the label line to:

```ts
const w = ctx.graph.createNode('process', `${node.isAsync ? 'async ' : ''}with ${node.items}`, 'rounded')
```

(`async for` needs no label change — the loop diamond `item in s.stream()?` already reads naturally; the fix is that the body now parses. This is a deliberate refinement of the spec's "prepend async" wording for `for`.)

- [ ] **Step 4: Run the full suite**

Run: `npx jest`
Expected: all suites PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/parser/python.ts __tests__/parser-python-accuracy.test.ts
git commit -m "fix(parser): support Python async constructs and def return annotations"
```
