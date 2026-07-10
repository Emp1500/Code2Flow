# Parser Accuracy Part 1 (JavaScript/TypeScript) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 confirmed JS/TS conversion-accuracy defects (spec: `docs/superpowers/specs/2026-07-10-parser-accuracy-design.md` fixes 1–5).

**Architecture:** All changes stay inside the existing pipeline: acorn AST → recursive `process*` handlers building a `FlowchartGraph` → Mermaid. We extract a shared `processFunctionBody` helper, add class/labeled-statement handlers, and extend `TraversalContext` with labeled-break targets and a throw target.

**Tech Stack:** TypeScript, acorn, jest (`npx jest`). Tests import via the `@/lib/parser` alias.

## Global Constraints

- No new dependencies.
- Only touch: `lib/parser/javascript.ts`, `lib/parser/types.ts`, new test file `__tests__/parser-js-accuracy.test.ts`.
- Existing tests in `__tests__/parser.test.ts` must keep passing (`npx jest`).
- Mermaid labels are escaped by `converter.ts` (`>` → `&gt;`, `"` → `'`) — test expectations must use the escaped form.
- Commit messages: conventional style, **no Co-Authored-By trailer**.

---

### Task 1: `processFunctionBody` helper + arrow/function-expression bodies (fix 1)

**Files:**
- Modify: `lib/parser/javascript.ts` (`processFunction` ~line 90, `processVariable` ~line 280, `processExpression` ~line 289)
- Test: `__tests__/parser-js-accuracy.test.ts` (create)

**Interfaces:**
- Consumes: existing `processBlock`, `formatExpression`, `TraversalContext`.
- Produces: `function processFunctionBody(label: string, endLabel: string, bodyStatements: any[], ctx: TraversalContext): BlockResult` and `function isBlockFunction(n: any): boolean` — Task 2 calls both.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/parser-js-accuracy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/parser-js-accuracy.test.ts`
Expected: 4 failures — output currently contains one opaque `const add = () =&gt; {...}` box, no `end add`.

- [ ] **Step 3: Implement**

In `lib/parser/javascript.ts`, replace `processFunction` with the helper + thin wrapper:

```ts
function processFunctionBody(label: string, endLabel: string, bodyStatements: any[], ctx: TraversalContext): BlockResult {
  const funcNode = ctx.graph.createNode('subroutine', label, 'rounded')
  const endNode  = ctx.graph.createNode('process', endLabel, 'rounded')
  const fCtx = ctx.clone()
  fCtx.currentNode = funcNode
  fCtx.returnTarget = endNode
  // function boundary: enclosing loop targets don't apply inside the body
  fCtx.breakTarget = null
  fCtx.continueTarget = null
  const body = processBlock(bodyStatements, fCtx)
  if (body.entry) ctx.graph.connect(funcNode, body.entry)
  if (body.exit)  ctx.graph.connect(body.exit, endNode)
  return { entry: funcNode, exit: endNode }
}

function isBlockFunction(n: any): boolean {
  return !!n && (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression') && n.body?.type === 'BlockStatement'
}

function functionLabel(prefix: string, fn: any): string {
  const params = fn.params.map((p: any) => formatExpression(p)).join(', ')
  return fn.type === 'ArrowFunctionExpression' ? `${prefix} = (${params}) =>` : `${prefix} = function(${params})`
}

function processFunction(node: any, ctx: TraversalContext): BlockResult {
  const name = node.id?.name ?? 'anonymous'
  const params = node.params.map((p: any) => formatExpression(p)).join(', ')
  return processFunctionBody(`function ${name}(${params})`, `end ${name}`, node.body.body, ctx)
}
```

Replace `processVariable`:

```ts
function processVariable(node: any, ctx: TraversalContext): BlockResult {
  if (!node.declarations.some((d: any) => isBlockFunction(d.init))) {
    const decls = node.declarations.map((d: any) => {
      const name = formatExpression(d.id)
      return d.init ? `${name} = ${formatExpression(d.init)}` : name
    }).join(', ')
    const n = ctx.graph.createNode('process', `${node.kind} ${decls}`, 'rectangle')
    return { entry: n, exit: n }
  }
  // At least one declarator holds a function with a block body: render each
  // declarator separately so the function's control flow stays visible.
  let first: FlowchartNode | null = null
  let prev: FlowchartNode | null = null
  for (const d of node.declarations) {
    const name = formatExpression(d.id)
    let r: BlockResult
    if (isBlockFunction(d.init)) {
      r = processFunctionBody(functionLabel(`${node.kind} ${name}`, d.init), `end ${name}`, d.init.body.body, ctx)
    } else {
      const label = d.init ? `${node.kind} ${name} = ${formatExpression(d.init)}` : `${node.kind} ${name}`
      const n = ctx.graph.createNode('process', label, 'rectangle')
      r = { entry: n, exit: n }
    }
    if (!first) first = r.entry
    if (prev && r.entry) ctx.graph.connect(prev, r.entry)
    prev = r.exit
  }
  return { entry: first, exit: prev }
}
```

Replace `processExpression`:

```ts
function processExpression(node: any, ctx: TraversalContext): BlockResult {
  const expr = node.expression
  if (expr.type === 'AssignmentExpression' && expr.operator === '=' && isBlockFunction(expr.right)) {
    const target = formatExpression(expr.left)
    return processFunctionBody(functionLabel(target, expr.right), `end ${target}`, expr.right.body.body, ctx)
  }
  const n = ctx.graph.createNode('process', formatExpression(expr), 'rectangle')
  return { entry: n, exit: n }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/parser-js-accuracy.test.ts __tests__/parser.test.ts`
Expected: all PASS (existing suite included).

- [ ] **Step 5: Commit**

```bash
git add lib/parser/javascript.ts __tests__/parser-js-accuracy.test.ts
git commit -m "fix(parser): render arrow/function-expression bodies as subroutines"
```

---

### Task 2: Class declarations render members (fix 2)

**Files:**
- Modify: `lib/parser/javascript.ts` (`processStatement` switch ~line 54, `formatExpression` ~line 11, `parseJS` ~line 39)
- Test: `__tests__/parser-js-accuracy.test.ts`

**Interfaces:**
- Consumes: `processFunctionBody`, `isBlockFunction`, `functionLabel` from Task 1.
- Produces: `function processClassJS(node: any, ctx: TraversalContext): BlockResult`.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/parser-js-accuracy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/parser-js-accuracy.test.ts -t "fix 2"`
Expected: FAIL — first test shows `ClassDeclaration` box; second may fail at parse (class fields need ecmaVersion > 2020).

- [ ] **Step 3: Implement**

In `parseJS`, change `ecmaVersion: 2020` → `ecmaVersion: 'latest'` (class fields are ES2022).

In `formatExpression`, add a case (anywhere in the switch): `case 'Super': text = 'super'; break`.

Add handler + switch cases:

```ts
function processClassJS(node: any, ctx: TraversalContext): BlockResult {
  const name = node.id?.name ?? 'anonymous'
  const base = node.superClass ? ` extends ${formatExpression(node.superClass)}` : ''
  const cls  = ctx.graph.createNode('subroutine', `class ${name}${base}`, 'rounded')
  let prev: FlowchartNode = cls
  for (const m of node.body.body) {
    let r: BlockResult | null = null
    if (m.type === 'MethodDefinition' && m.value?.body) {
      const key = formatExpression(m.key)
      const params = m.value.params.map((p: any) => formatExpression(p)).join(', ')
      let label = `${key}(${params})`
      if (m.kind === 'get') label = `get ${label}`
      if (m.kind === 'set') label = `set ${label}`
      if (m.static) label = `static ${label}`
      r = processFunctionBody(label, `end ${key}`, m.value.body.body, ctx)
    } else if (m.type === 'PropertyDefinition') {
      const key = formatExpression(m.key)
      if (isBlockFunction(m.value)) {
        r = processFunctionBody(functionLabel(key, m.value), `end ${key}`, m.value.body.body, ctx)
      } else {
        const n = ctx.graph.createNode('process', m.value ? `${key} = ${formatExpression(m.value)}` : key, 'rectangle')
        r = { entry: n, exit: n }
      }
    }
    if (r?.entry) { ctx.graph.connect(prev, r.entry); prev = r.exit ?? prev }
  }
  return { entry: cls, exit: prev }
}
```

In `processStatement`, add before `default`: `case 'ClassDeclaration': return processClassJS(node, ctx)`.

In Task 1's `processVariable` function-path loop, extend the special case: change the `some(...)` guard to `node.declarations.some((d: any) => isBlockFunction(d.init) || d.init?.type === 'ClassExpression')` and inside the loop add before the `isBlockFunction` branch:

```ts
if (d.init?.type === 'ClassExpression') {
  r = processClassJS({ ...d.init, id: d.init.id ?? d.id }, ctx)
} else if (isBlockFunction(d.init)) { ...existing... }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/parser-js-accuracy.test.ts __tests__/parser.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/parser/javascript.ts __tests__/parser-js-accuracy.test.ts
git commit -m "fix(parser): render class members instead of opaque ClassDeclaration box"
```

---

### Task 3: Switch without default gets a no-match edge (fix 3)

**Files:**
- Modify: `lib/parser/javascript.ts` (`processSwitch` ~line 200)
- Test: `__tests__/parser-js-accuracy.test.ts`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/parser-js-accuracy.test.ts -t "fix 3"`
Expected: first test FAILs (no `no match` edge exists today).

- [ ] **Step 3: Implement**

In `processSwitch`, before `return { entry: sw, exit: after }`:

```ts
if (!node.cases.some((c: any) => !c.test)) ctx.graph.connect(sw, after, 'no match')
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/parser-js-accuracy.test.ts __tests__/parser.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/parser/javascript.ts __tests__/parser-js-accuracy.test.ts
git commit -m "fix(parser): add no-match exit edge for switch without default"
```

---

### Task 4: Labeled statements + labeled break/continue (fix 4)

**Files:**
- Modify: `lib/parser/types.ts` (`TraversalContext` ~line 56)
- Modify: `lib/parser/javascript.ts` (`processStatement`, `processFor`, `processWhile`, `processDoWhile`, `processForIn`, `processSwitch`, `processBreak`, `processContinue`)
- Test: `__tests__/parser-js-accuracy.test.ts`

**Interfaces:**
- Produces on `TraversalContext`: `labeledTargets: Record<string, { break: FlowchartNode | null; continue: FlowchartNode | null }>` and `pendingLabel: string | null` (both copied by `clone()`).

- [ ] **Step 1: Write the failing test**

```ts
describe('fix 4: labeled statements', () => {
  test('labeled loop renders and break outer exits the outer loop', () => {
    const code = 'outer: for (const a of xs) {\n  for (const b of ys) {\n    if (a === b) break outer\n  }\n}\ndone()'
    const out = codeToMermaid(code, 'javascript')
    expect(out).not.toContain('"Labeled"')
    expect(out).toContain('a of xs?')
    const breakId = out.match(/(N\d+)\["break outer"\]/)?.[1]
    const doneId  = out.match(/(N\d+)\["done\(\)"\]/)?.[1]
    expect(breakId).toBeTruthy()
    expect(doneId).toBeTruthy()
    // the node break jumps to must be the outer loop's merge — the one that leads to done()
    const outerMerge = out.match(new RegExp(`(N\\d+) --> ${doneId}\\b`))?.[1]
    expect(out).toContain(`${breakId} --> ${outerMerge}`)
  })

  test('labeled continue targets the labeled loop condition', () => {
    const code = 'outer: while (a) {\n  while (b) {\n    continue outer\n  }\n}'
    const out = codeToMermaid(code, 'javascript')
    const contId = out.match(/(N\d+)\["continue outer"\]/)?.[1]
    const outerCond = out.match(/(N\d+)\{"a\?"\}/)?.[1]
    expect(out).toContain(`${contId} --> ${outerCond}`)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/parser-js-accuracy.test.ts -t "fix 4"`
Expected: FAIL — output contains a single node labeled `Labeled`.

- [ ] **Step 3: Implement**

`lib/parser/types.ts` — add to `TraversalContext`:

```ts
labeledTargets: Record<string, { break: FlowchartNode | null; continue: FlowchartNode | null }> = {}
pendingLabel: string | null = null
```

and in `clone()` add:

```ts
ctx.labeledTargets = { ...this.labeledTargets }
ctx.pendingLabel = this.pendingLabel
```

`lib/parser/javascript.ts` — in `processStatement`, add before `default`:

```ts
case 'LabeledStatement': {
  const lCtx = ctx.clone()
  lCtx.pendingLabel = node.label.name
  return processStatement(node.body, lCtx)
}
```

Add this registration line to each loop handler, immediately **before** the body context is cloned (the `ctx.clone()` call for `loopCtx`/`lCtx`), so the body context inherits the entry. The `continue` value differs per handler:

- `processFor` (before `const loopCtx = ctx.clone()`):
  `if (ctx.pendingLabel) { ctx.labeledTargets[ctx.pendingLabel] = { break: after, continue: update ?? cond }; ctx.pendingLabel = null }`
- `processWhile` (before `const lCtx = ctx.clone()`):
  `if (ctx.pendingLabel) { ctx.labeledTargets[ctx.pendingLabel] = { break: after, continue: cond }; ctx.pendingLabel = null }`
- `processDoWhile` (before `const lCtx = ctx.clone()`):
  `if (ctx.pendingLabel) { ctx.labeledTargets[ctx.pendingLabel] = { break: after, continue: cond }; ctx.pendingLabel = null }`
- `processForIn` (before `const lCtx = ctx.clone()`):
  `if (ctx.pendingLabel) { ctx.labeledTargets[ctx.pendingLabel] = { break: after, continue: cond }; ctx.pendingLabel = null }`
- `processSwitch` (before the `for (const c of node.cases)` loop):
  `if (ctx.pendingLabel) { ctx.labeledTargets[ctx.pendingLabel] = { break: after, continue: null }; ctx.pendingLabel = null }`

Replace `processBreak` and `processContinue`:

```ts
function processBreak(node: any, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', node.label ? `break ${node.label.name}` : 'break', 'rectangle')
  const target = node.label ? ctx.labeledTargets[node.label.name]?.break ?? ctx.breakTarget : ctx.breakTarget
  if (target) ctx.graph.connect(n, target)
  return { entry: n, exit: null }
}

function processContinue(node: any, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', node.label ? `continue ${node.label.name}` : 'continue', 'rectangle')
  const target = node.label ? ctx.labeledTargets[node.label.name]?.continue ?? ctx.continueTarget : ctx.continueTarget
  if (target) ctx.graph.connect(n, target)
  return { entry: n, exit: null }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/parser-js-accuracy.test.ts __tests__/parser.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/parser/types.ts lib/parser/javascript.ts __tests__/parser-js-accuracy.test.ts
git commit -m "fix(parser): support labeled statements and labeled break/continue"
```

---

### Task 5: `throw` routes to the enclosing catch (fix 5, JS half)

**Files:**
- Modify: `lib/parser/types.ts` (`TraversalContext`)
- Modify: `lib/parser/javascript.ts` (`processTry` ~line 223, `processThrow` ~line 275, `processFunctionBody` from Task 1)
- Test: `__tests__/parser-js-accuracy.test.ts`

**Interfaces:**
- Produces on `TraversalContext`: `throwTarget: FlowchartNode | null` (copied by `clone()`) — Part 2's Python raise-routing task consumes this.

- [ ] **Step 1: Write the failing test**

```ts
describe('fix 5: throw routes to catch', () => {
  test('throw inside try connects to the catch node', () => {
    const code = "try {\n  if (bad) throw new Error('x')\n  ok()\n} catch (e) {\n  handle(e)\n}"
    const out = codeToMermaid(code, 'javascript')
    const throwId = out.match(/(N\d+)\["throw new Error\('x'\)"\]/)?.[1]
    const catchId = out.match(/(N\d+)\(\["catch \(e\)"\]\)/)?.[1]
    expect(throwId).toBeTruthy()
    expect(catchId).toBeTruthy()
    expect(out).toContain(`${throwId} --> ${catchId}`)
  })

  test('throw with no enclosing try stays terminal', () => {
    const out = codeToMermaid("throw new Error('boom')", 'javascript')
    const throwId = out.match(/(N\d+)\["throw new Error\('boom'\)"\]/)?.[1]
    expect(out).not.toMatch(new RegExp(`${throwId} --> `))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/parser-js-accuracy.test.ts -t "fix 5"`
Expected: first test FAILs (throw node has no outgoing edge).

- [ ] **Step 3: Implement**

`lib/parser/types.ts` — add to `TraversalContext`: `throwTarget: FlowchartNode | null = null`, and in `clone()`: `ctx.throwTarget = this.throwTarget`.

`lib/parser/javascript.ts` — in `processFunctionBody`, next to the break/continue resets add `fCtx.throwTarget = null` (a function's throw fires at call time, not where it's defined).

Replace `processTry` — the catch/finally nodes are now created **before** the try body is walked so the body's context can point at them:

```ts
function processTry(node: any, ctx: TraversalContext): BlockResult {
  const tryNode = ctx.graph.createNode('process', 'try', 'rounded')
  const after   = ctx.graph.createNode('merge' as any, '', 'circle')

  let catchNode: FlowchartNode | null = null
  if (node.handler) {
    const param = node.handler.param ? formatExpression(node.handler.param) : 'error'
    catchNode = ctx.graph.createNode('process', `catch (${param})`, 'rounded')
    ctx.graph.connect(tryNode, catchNode, 'error')
  }
  const finallyNode: FlowchartNode | null = node.finalizer
    ? ctx.graph.createNode('process', 'finally', 'rounded')
    : null

  const tCtx = ctx.clone(); tCtx.currentNode = tryNode
  tCtx.throwTarget = catchNode ?? finallyNode
  const tryRes = processBlock(node.block.body, tCtx)
  if (tryRes.entry) ctx.graph.connect(tryNode, tryRes.entry)

  if (finallyNode) {
    const fCtx = ctx.clone(); fCtx.currentNode = finallyNode
    const fRes = processBlock(node.finalizer.body, fCtx)
    if (fRes.entry) ctx.graph.connect(finallyNode, fRes.entry)
    ctx.graph.connect(fRes.exit ?? finallyNode, after)
  }

  const target = finallyNode ?? after
  if (tryRes.exit) ctx.graph.connect(tryRes.exit, target)

  if (catchNode) {
    const cCtx = ctx.clone(); cCtx.currentNode = catchNode
    const cRes = processBlock(node.handler.body.body, cCtx)
    if (cRes.entry) ctx.graph.connect(catchNode, cRes.entry)
    ctx.graph.connect(cRes.exit ?? catchNode, target)
  }

  return { entry: tryNode, exit: after }
}
```

(Note: the catch body's context clones from the **outer** ctx, so a throw inside catch correctly propagates outward, not back into the same catch.)

Replace `processThrow`:

```ts
function processThrow(node: any, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', `throw ${formatExpression(node.argument)}`, 'rectangle')
  if (ctx.throwTarget) ctx.graph.connect(n, ctx.throwTarget)
  return { entry: n, exit: null }
}
```

- [ ] **Step 4: Run the full suite**

Run: `npx jest`
Expected: all suites PASS (node-creation order inside try changed; existing tests assert labels, not ids).

- [ ] **Step 5: Commit**

```bash
git add lib/parser/types.ts lib/parser/javascript.ts __tests__/parser-js-accuracy.test.ts
git commit -m "fix(parser): route throw statements to the enclosing catch"
```
