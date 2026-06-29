# Plan 2: Parser Migration to TypeScript

> **Prereq:** plan-1-foundation.md complete.

**Goal:** Extract parser logic from `public/app.js` into typed TypeScript modules with Jest tests.

---

## Task 4: Parser Types + Converter

**Files:** `lib/parser/types.ts`, `lib/parser/converter.ts`

- [ ] **4.1 Write `lib/parser/types.ts`**
```ts
export type NodeShape = 'circle' | 'diamond' | 'rectangle' | 'rounded' | 'parallelogram'
export type NodeType = 'start' | 'end' | 'process' | 'decision' | 'io' | 'subroutine' | 'merge'
export type SupportedLanguage = 'javascript' | 'typescript' | 'python'

export class FlowchartNode {
  constructor(
    public id: string,
    public type: NodeType,
    public label: string,
    public shape: NodeShape = 'rectangle'
  ) {}
}

export class FlowchartEdge {
  constructor(public from: string, public to: string, public label = '') {}
}

export class FlowchartGraph {
  nodes: FlowchartNode[] = []
  edges: FlowchartEdge[] = []
  private nodeCounter = 0

  createNode(type: NodeType, label: string, shape: NodeShape = 'rectangle'): FlowchartNode {
    const node = new FlowchartNode(`N${this.nodeCounter++}`, type, label, shape)
    this.nodes.push(node)
    return node
  }

  connect(from: FlowchartNode | null, to: FlowchartNode | null, label = ''): void {
    if (from && to) this.edges.push(new FlowchartEdge(from.id, to.id, label))
  }
}

export class TraversalContext {
  currentNode: FlowchartNode | null = null
  breakTarget: FlowchartNode | null = null
  continueTarget: FlowchartNode | null = null
  returnTarget: FlowchartNode | null = null

  constructor(public graph: FlowchartGraph) {}

  clone(): TraversalContext {
    const ctx = new TraversalContext(this.graph)
    ctx.currentNode = this.currentNode
    ctx.breakTarget = this.breakTarget
    ctx.continueTarget = this.continueTarget
    ctx.returnTarget = this.returnTarget
    return ctx
  }
}

export interface BlockResult {
  entry: FlowchartNode | null
  exit: FlowchartNode | null
}
```

- [ ] **4.2 Write `lib/parser/converter.ts`**
```ts
import type { FlowchartGraph } from './types'

function escapeLabel(text: string): string {
  return (text || '')
    .replace(/"/g, "'")
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&(?!lt;|gt;|amp;|quot;)/g, '&amp;')
    .replace(/\n/g, ' ')
    .substring(0, 80)
}

export function graphToMermaid(graph: FlowchartGraph): string {
  let out = 'flowchart TD\n'

  for (const node of graph.nodes) {
    const label = escapeLabel(node.label)
    if (node.type === 'merge' && !node.label) {
      out += `    ${node.id}(( ))\n`
      continue
    }
    switch (node.shape) {
      case 'circle':        out += `    ${node.id}(("${label}"))\n`; break
      case 'diamond':       out += `    ${node.id}{"${label}"}\n`; break
      case 'rounded':       out += `    ${node.id}(["${label}"])\n`; break
      case 'parallelogram': out += `    ${node.id}[/"${label}"/]\n`; break
      default:              out += `    ${node.id}["${label}"]\n`
    }
  }

  for (const edge of graph.edges) {
    if (edge.label) out += `    ${edge.from} -->|${edge.label}| ${edge.to}\n`
    else            out += `    ${edge.from} --> ${edge.to}\n`
  }

  return out
}
```

- [ ] **4.3 Commit**
```bash
git add lib/parser/types.ts lib/parser/converter.ts
git commit -m "feat: add parser types and Mermaid converter"
```

---

## Task 5: JavaScript Parser

**File:** `lib/parser/javascript.ts`

- [ ] **5.1 Write `lib/parser/javascript.ts`**
```ts
import * as acorn from 'acorn'
import { FlowchartGraph, TraversalContext, type BlockResult, type FlowchartNode } from './types'

// ── Expression formatter ────────────────────────────────────────────────────

export function formatExpression(node: acorn.Node | null, maxLen = 60): string {
  if (!node) return ''
  const n = node as any
  let text = ''
  switch (n.type) {
    case 'Identifier':         text = n.name; break
    case 'Literal':            text = n.raw ?? String(n.value); break
    case 'BinaryExpression':
    case 'LogicalExpression':  text = `${formatExpression(n.left)} ${n.operator} ${formatExpression(n.right)}`; break
    case 'UnaryExpression':
    case 'UpdateExpression':   text = n.prefix ? `${n.operator}${formatExpression(n.argument)}` : `${formatExpression(n.argument)}${n.operator}`; break
    case 'AssignmentExpression': text = `${formatExpression(n.left)} ${n.operator} ${formatExpression(n.right)}`; break
    case 'MemberExpression':   text = n.computed ? `${formatExpression(n.object)}[${formatExpression(n.property)}]` : `${formatExpression(n.object)}.${formatExpression(n.property)}`; break
    case 'CallExpression':     text = `${formatExpression(n.callee)}(${n.arguments.map((a: any) => formatExpression(a)).join(', ')})`; break
    case 'ConditionalExpression': text = `${formatExpression(n.test)} ? ${formatExpression(n.consequent)} : ${formatExpression(n.alternate)}`; break
    case 'ArrayExpression':    text = `[${n.elements.map((e: any) => formatExpression(e)).join(', ')}]`; break
    case 'ObjectExpression':   text = '{...}'; break
    case 'NewExpression':      text = `new ${formatExpression(n.callee)}(${n.arguments.map((a: any) => formatExpression(a)).join(', ')})`; break
    case 'SequenceExpression': text = n.expressions.map((e: any) => formatExpression(e)).join(', '); break
    case 'ThisExpression':     text = 'this'; break
    case 'TemplateLiteral':    text = '`...`'; break
    case 'ArrowFunctionExpression': text = '() => {...}'; break
    case 'FunctionExpression': text = 'function() {...}'; break
    default: text = n.type ?? '[expr]'
  }
  return text.length > maxLen ? text.substring(0, maxLen - 3) + '...' : text
}

// ── Parser ──────────────────────────────────────────────────────────────────

export function parseJS(code: string): acorn.Program {
  try {
    return acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    }) as acorn.Program
  } catch (e: any) {
    throw new Error(`JavaScript Parse Error at line ${e.loc?.line ?? '?'}: ${e.message}`)
  }
}

// ── Statement handlers ───────────────────────────────────────────────────────

export function processStatement(node: any, ctx: TraversalContext): BlockResult {
  if (!node) return { entry: null, exit: null }
  switch (node.type) {
    case 'FunctionDeclaration': return processFunction(node, ctx)
    case 'IfStatement':         return processIf(node, ctx)
    case 'ForStatement':        return processFor(node, ctx)
    case 'WhileStatement':      return processWhile(node, ctx)
    case 'DoWhileStatement':    return processDoWhile(node, ctx)
    case 'ForInStatement':
    case 'ForOfStatement':      return processForIn(node, ctx)
    case 'SwitchStatement':     return processSwitch(node, ctx)
    case 'TryStatement':        return processTry(node, ctx)
    case 'ReturnStatement':     return processReturn(node, ctx)
    case 'BreakStatement':      return processBreak(node, ctx)
    case 'ContinueStatement':   return processContinue(node, ctx)
    case 'ThrowStatement':      return processThrow(node, ctx)
    case 'BlockStatement':      return processBlock(node.body, ctx)
    case 'VariableDeclaration': return processVariable(node, ctx)
    case 'ExpressionStatement': return processExpression(node, ctx)
    case 'EmptyStatement':      return { entry: null, exit: ctx.currentNode }
    default: {
      const n = ctx.graph.createNode('process', node.type.replace('Statement', ''), 'rectangle')
      return { entry: n, exit: n }
    }
  }
}

function processFunction(node: any, ctx: TraversalContext): BlockResult {
  const name = node.id?.name ?? 'anonymous'
  const params = node.params.map((p: any) => formatExpression(p)).join(', ')
  const funcNode = ctx.graph.createNode('subroutine', `function ${name}(${params})`, 'rounded')
  const endNode  = ctx.graph.createNode('process', `end ${name}`, 'rounded')
  const fCtx = ctx.clone(); fCtx.currentNode = funcNode; fCtx.returnTarget = endNode
  const body = processBlock(node.body.body, fCtx)
  if (body.entry) ctx.graph.connect(funcNode, body.entry)
  if (body.exit)  ctx.graph.connect(body.exit, endNode)
  return { entry: funcNode, exit: endNode }
}

function processIf(node: any, ctx: TraversalContext): BlockResult {
  const cond  = ctx.graph.createNode('decision', formatExpression(node.test) + '?', 'diamond')
  const merge = ctx.graph.createNode('merge' as any, '', 'circle')

  const trueBody = node.consequent.type === 'BlockStatement' ? node.consequent.body : [node.consequent]
  const trueCtx  = ctx.clone(); trueCtx.currentNode = cond
  const trueRes  = processBlock(trueBody, trueCtx)
  if (trueRes.entry) { ctx.graph.connect(cond, trueRes.entry, 'Yes'); if (trueRes.exit) ctx.graph.connect(trueRes.exit, merge) }
  else ctx.graph.connect(cond, merge, 'Yes')

  if (node.alternate) {
    const falseCtx = ctx.clone(); falseCtx.currentNode = cond
    if (node.alternate.type === 'IfStatement') {
      const r = processIf(node.alternate, falseCtx)
      ctx.graph.connect(cond, r.entry!, 'No')
      if (r.exit) ctx.graph.connect(r.exit, merge)
    } else {
      const falseBody = node.alternate.type === 'BlockStatement' ? node.alternate.body : [node.alternate]
      const r = processBlock(falseBody, falseCtx)
      if (r.entry) { ctx.graph.connect(cond, r.entry, 'No'); if (r.exit) ctx.graph.connect(r.exit, merge) }
      else ctx.graph.connect(cond, merge, 'No')
    }
  } else {
    ctx.graph.connect(cond, merge, 'No')
  }

  return { entry: cond, exit: merge }
}

function processFor(node: any, ctx: TraversalContext): BlockResult {
  let initNode: FlowchartNode | null = null
  if (node.init) {
    const label = node.init.type === 'VariableDeclaration'
      ? node.init.declarations.map((d: any) => `${node.init.kind} ${formatExpression(d.id)} = ${formatExpression(d.init)}`).join(', ')
      : formatExpression(node.init)
    initNode = ctx.graph.createNode('process', label, 'rectangle')
  }
  const cond   = ctx.graph.createNode('decision', (node.test ? formatExpression(node.test) : 'true') + '?', 'diamond')
  const after  = ctx.graph.createNode('merge' as any, '', 'circle')
  const update = node.update ? ctx.graph.createNode('process', formatExpression(node.update), 'rectangle') : null
  if (initNode) ctx.graph.connect(initNode, cond)

  const loopCtx = ctx.clone(); loopCtx.currentNode = cond
  loopCtx.breakTarget = after; loopCtx.continueTarget = update ?? cond
  const body = node.body.type === 'BlockStatement' ? node.body.body : [node.body]
  const r = processBlock(body, loopCtx)

  if (r.entry) {
    ctx.graph.connect(cond, r.entry, 'Yes')
    if (r.exit) { update ? (ctx.graph.connect(r.exit, update), ctx.graph.connect(update, cond)) : ctx.graph.connect(r.exit, cond) }
  } else if (update) { ctx.graph.connect(cond, update, 'Yes'); ctx.graph.connect(update, cond) }
  ctx.graph.connect(cond, after, 'No')

  return { entry: initNode ?? cond, exit: after }
}

function processWhile(node: any, ctx: TraversalContext): BlockResult {
  const cond  = ctx.graph.createNode('decision', formatExpression(node.test) + '?', 'diamond')
  const after = ctx.graph.createNode('merge' as any, '', 'circle')
  const lCtx  = ctx.clone(); lCtx.currentNode = cond; lCtx.breakTarget = after; lCtx.continueTarget = cond
  const body  = node.body.type === 'BlockStatement' ? node.body.body : [node.body]
  const r     = processBlock(body, lCtx)
  if (r.entry) { ctx.graph.connect(cond, r.entry, 'Yes'); if (r.exit) ctx.graph.connect(r.exit, cond) }
  else ctx.graph.connect(cond, cond, 'Yes')
  ctx.graph.connect(cond, after, 'No')
  return { entry: cond, exit: after }
}

function processDoWhile(node: any, ctx: TraversalContext): BlockResult {
  const bodyStart = ctx.graph.createNode('process', 'do', 'rounded')
  const cond      = ctx.graph.createNode('decision', formatExpression(node.test) + '?', 'diamond')
  const after     = ctx.graph.createNode('merge' as any, '', 'circle')
  const lCtx      = ctx.clone(); lCtx.currentNode = bodyStart; lCtx.breakTarget = after; lCtx.continueTarget = cond
  const body      = node.body.type === 'BlockStatement' ? node.body.body : [node.body]
  const r         = processBlock(body, lCtx)
  if (r.entry) { ctx.graph.connect(bodyStart, r.entry); if (r.exit) ctx.graph.connect(r.exit, cond) }
  else ctx.graph.connect(bodyStart, cond)
  ctx.graph.connect(cond, bodyStart, 'Yes')
  ctx.graph.connect(cond, after, 'No')
  return { entry: bodyStart, exit: after }
}

function processForIn(node: any, ctx: TraversalContext): BlockResult {
  const left  = node.left.type === 'VariableDeclaration' ? `${node.left.kind} ${formatExpression(node.left.declarations[0].id)}` : formatExpression(node.left)
  const kw    = node.type === 'ForOfStatement' ? 'of' : 'in'
  const cond  = ctx.graph.createNode('decision', `${left} ${kw} ${formatExpression(node.right)}?`, 'diamond')
  const after = ctx.graph.createNode('merge' as any, '', 'circle')
  const lCtx  = ctx.clone(); lCtx.currentNode = cond; lCtx.breakTarget = after; lCtx.continueTarget = cond
  const body  = node.body.type === 'BlockStatement' ? node.body.body : [node.body]
  const r     = processBlock(body, lCtx)
  if (r.entry) { ctx.graph.connect(cond, r.entry, 'Yes'); if (r.exit) ctx.graph.connect(r.exit, cond) }
  ctx.graph.connect(cond, after, 'No')
  return { entry: cond, exit: after }
}

function processSwitch(node: any, ctx: TraversalContext): BlockResult {
  const sw    = ctx.graph.createNode('decision', `switch (${formatExpression(node.discriminant)})`, 'diamond')
  const after = ctx.graph.createNode('merge' as any, '', 'circle')
  let fallthrough: FlowchartNode | null = null

  for (const c of node.cases) {
    const label    = c.test ? `case ${formatExpression(c.test)}` : 'default'
    const caseNode = ctx.graph.createNode('process', label, 'rectangle')
    ctx.graph.connect(sw, caseNode, c.test ? formatExpression(c.test) : 'default')
    if (fallthrough) { ctx.graph.connect(fallthrough, caseNode); fallthrough = null }
    const cCtx = ctx.clone(); cCtx.currentNode = caseNode; cCtx.breakTarget = after
    const r    = processBlock(c.consequent, cCtx)
    if (r.entry) {
      ctx.graph.connect(caseNode, r.entry)
      const last = c.consequent[c.consequent.length - 1]
      if (r.exit && !(last?.type === 'BreakStatement')) fallthrough = r.exit
    } else fallthrough = caseNode
  }

  if (fallthrough) ctx.graph.connect(fallthrough, after)
  return { entry: sw, exit: after }
}

function processTry(node: any, ctx: TraversalContext): BlockResult {
  const tryNode = ctx.graph.createNode('process', 'try', 'rounded')
  const after   = ctx.graph.createNode('merge' as any, '', 'circle')
  const tCtx    = ctx.clone(); tCtx.currentNode = tryNode
  const tryRes  = processBlock(node.block.body, tCtx)
  if (tryRes.entry) ctx.graph.connect(tryNode, tryRes.entry)
  let finallyNode: FlowchartNode | null = null

  if (node.finalizer) {
    finallyNode = ctx.graph.createNode('process', 'finally', 'rounded')
    const fCtx  = ctx.clone(); fCtx.currentNode = finallyNode
    const fRes  = processBlock(node.finalizer.body, fCtx)
    if (fRes.entry) ctx.graph.connect(finallyNode, fRes.entry)
    ctx.graph.connect(fRes.exit ?? finallyNode, after)
  }

  const target = finallyNode ?? after
  if (tryRes.exit) ctx.graph.connect(tryRes.exit, target)

  if (node.handler) {
    const param    = node.handler.param ? formatExpression(node.handler.param) : 'error'
    const catchNode = ctx.graph.createNode('process', `catch (${param})`, 'rounded')
    ctx.graph.connect(tryNode, catchNode, 'error')
    const cCtx = ctx.clone(); cCtx.currentNode = catchNode
    const cRes = processBlock(node.handler.body.body, cCtx)
    if (cRes.entry) ctx.graph.connect(catchNode, cRes.entry)
    if (cRes.exit)  ctx.graph.connect(cRes.exit, target)
    else ctx.graph.connect(catchNode, target)
  }

  return { entry: tryNode, exit: after }
}

function processReturn(node: any, ctx: TraversalContext): BlockResult {
  const label = node.argument ? `return ${formatExpression(node.argument)}` : 'return'
  const n     = ctx.graph.createNode('process', label, 'rectangle')
  if (ctx.returnTarget) ctx.graph.connect(n, ctx.returnTarget)
  return { entry: n, exit: null }
}

function processBreak(node: any, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', node.label ? `break ${node.label.name}` : 'break', 'rectangle')
  if (ctx.breakTarget) ctx.graph.connect(n, ctx.breakTarget)
  return { entry: n, exit: null }
}

function processContinue(node: any, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', node.label ? `continue ${node.label.name}` : 'continue', 'rectangle')
  if (ctx.continueTarget) ctx.graph.connect(n, ctx.continueTarget)
  return { entry: n, exit: null }
}

function processThrow(node: any, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', `throw ${formatExpression(node.argument)}`, 'rectangle')
  return { entry: n, exit: null }
}

function processVariable(node: any, ctx: TraversalContext): BlockResult {
  const decls = node.declarations.map((d: any) => {
    const name = formatExpression(d.id)
    return d.init ? `${name} = ${formatExpression(d.init)}` : name
  }).join(', ')
  const n = ctx.graph.createNode('process', `${node.kind} ${decls}`, 'rectangle')
  return { entry: n, exit: n }
}

function processExpression(node: any, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', formatExpression(node.expression), 'rectangle')
  return { entry: n, exit: n }
}

export function processBlock(statements: any[], ctx: TraversalContext): BlockResult {
  if (!statements?.length) return { entry: null, exit: ctx.currentNode }
  let first: FlowchartNode | null = null
  let current = ctx.currentNode

  for (const stmt of statements) {
    const sCtx = ctx.clone(); sCtx.currentNode = current
    const r    = processStatement(stmt, sCtx)
    if (r.entry) {
      if (!first) first = r.entry
      if (current && current !== ctx.currentNode) ctx.graph.connect(current, r.entry)
      current = r.exit
    }
    if (r.exit === null) return { entry: first, exit: null }
  }

  return { entry: first, exit: current }
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function convertJS(code: string): FlowchartGraph {
  const graph    = new FlowchartGraph()
  const start    = graph.createNode('start', 'Start', 'circle')
  const end      = graph.createNode('end', 'End', 'circle')
  const ctx      = new TraversalContext(graph)
  ctx.currentNode = start

  const ast = parseJS(code)
  const r   = processBlock((ast as any).body, ctx)

  graph.connect(start, r.entry ?? end)
  if (r.exit) graph.connect(r.exit, end)

  return graph
}
```

- [ ] **5.2 Write `lib/parser/typescript.ts`**
```ts
// TypeScript uses the same parser as JavaScript (Acorn ecmaVersion 2020 covers TS-like syntax)
// For full TS AST support, swap acorn for @typescript-eslint/typescript-estree in a future iteration.
export { convertJS as convertTS } from './javascript'
```

- [ ] **5.3 Commit**
```bash
git add lib/parser/javascript.ts lib/parser/typescript.ts
git commit -m "feat: migrate JavaScript/TypeScript parser to TypeScript"
```

---

## Task 6: Python Parser

**File:** `lib/parser/python.ts`

- [ ] **6.1 Write `lib/parser/python.ts`**
```ts
import { FlowchartGraph, TraversalContext, type BlockResult, type FlowchartNode } from './types'

// ── Tokenizer ────────────────────────────────────────────────────────────────

interface PyNode { type: string; body?: PyNode[]; [key: string]: any }

function getIndent(line: string): number {
  let n = 0
  for (const c of line) { if (c === ' ') n++; else if (c === '\t') n += 4; else break }
  return n
}

function parseLine(line: string, lineNum: number): PyNode | null {
  let m: RegExpMatchArray | null

  if ((m = line.match(/^def\s+(\w+)\s*\((.*?)\)\s*:/)))
    return { type: 'FunctionDef', name: m[1], params: m[2], body: [], line: lineNum }
  if ((m = line.match(/^class\s+(\w+)(?:\s*\((.*?)\))?\s*:/)))
    return { type: 'ClassDef', name: m[1], bases: m[2] ?? '', body: [], line: lineNum }
  if ((m = line.match(/^if\s+(.+)\s*:/)))
    return { type: 'If', test: m[1], body: [], orelse: [], line: lineNum }
  if ((m = line.match(/^elif\s+(.+)\s*:/)))
    return { type: 'Elif', test: m[1], body: [], line: lineNum }
  if (line === 'else:')
    return { type: 'Else', body: [], line: lineNum }
  if ((m = line.match(/^for\s+(.+)\s+in\s+(.+)\s*:/)))
    return { type: 'For', target: m[1], iter: m[2], body: [], line: lineNum }
  if ((m = line.match(/^while\s+(.+)\s*:/)))
    return { type: 'While', test: m[1], body: [], line: lineNum }
  if (line === 'try:')
    return { type: 'Try', body: [], handlers: [], finalbody: null, line: lineNum }
  if ((m = line.match(/^except(?:\s+(\w+)(?:\s+as\s+(\w+))?)?\s*:/)))
    return { type: 'ExceptHandler', exceptionType: m?.[1] ?? '', name: m?.[2] ?? '', body: [], line: lineNum }
  if (line === 'finally:')
    return { type: 'Finally', body: [], line: lineNum }
  if ((m = line.match(/^with\s+(.+)\s*:/)))
    return { type: 'With', items: m[1], body: [], line: lineNum }
  if ((m = line.match(/^return(?:\s+(.+))?$/)))
    return { type: 'Return', value: m?.[1] ?? '', line: lineNum }
  if (line === 'break')  return { type: 'Break', line: lineNum }
  if (line === 'continue') return { type: 'Continue', line: lineNum }
  if (line === 'pass')   return { type: 'Pass', line: lineNum }
  if ((m = line.match(/^raise(?:\s+(.+))?$/)))
    return { type: 'Raise', exception: m?.[1] ?? '', line: lineNum }
  if ((m = line.match(/^match\s+(.+)\s*:$/)))
    return { type: 'Match', subject: m[1], cases: [], body: [], line: lineNum }
  if ((m = line.match(/^case\s+(.+)\s*:$/)))
    return { type: 'Case', pattern: m[1], body: [], line: lineNum }

  return { type: 'Expr', value: line, line: lineNum }
}

function getLastIf(node: PyNode): PyNode {
  if (node.orelse?.length && node.orelse[node.orelse.length - 1].type === 'If')
    return getLastIf(node.orelse[node.orelse.length - 1])
  return node
}

export function parsePython(code: string): PyNode {
  const lines = code.split('\n')
  const ast: PyNode = { type: 'Program', body: [] }
  const stack: Array<{ indent: number; node: PyNode; type: string }> = [{ indent: -1, node: ast, type: 'program' }]

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = getIndent(raw)

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1]
    const node   = parseLine(trimmed, i + 1)
    if (!node) continue

    // Attach elif/else to previous if
    if (node.type === 'Elif' || node.type === 'Else') {
      const body = parent.node.body ?? []
      const last = [...body].reverse().find((n: PyNode) => n.type === 'If' || n.type === 'For' || n.type === 'While')
      if (last) {
        if (node.type === 'Elif') {
          const nested: PyNode = { type: 'If', test: node.test, body: [], orelse: [] }
          const tail = getLastIf(last.type === 'If' ? last : { type: 'If', orelse: [] })
          tail.orelse = tail.orelse ?? []
          tail.orelse.push(nested)
          if (trimmed.endsWith(':')) stack.push({ indent, node: nested, type: 'If' })
        } else {
          // else — attach to if or loop
          if (last.type === 'For' || last.type === 'While') { last.orelse = node }
          else { const tail = getLastIf(last); tail._elseNode = node }
          if (trimmed.endsWith(':')) stack.push({ indent, node, type: 'Else' })
        }
        continue
      }
    }

    // Attach except/finally to most recent try
    if (node.type === 'ExceptHandler' || node.type === 'Finally') {
      const body = parent.node.body ?? []
      const tryNode = [...body].reverse().find((n: PyNode) => n.type === 'Try')
      if (tryNode) {
        if (node.type === 'ExceptHandler') tryNode.handlers.push(node)
        else tryNode.finalbody = node
        if (trimmed.endsWith(':')) stack.push({ indent, node, type: node.type })
        continue
      }
    }

    // Attach case to most recent match
    if (node.type === 'Case') {
      const body = parent.node.body ?? []
      const matchNode = [...body].reverse().find((n: PyNode) => n.type === 'Match')
      if (matchNode) {
        matchNode.cases.push(node)
        if (trimmed.endsWith(':')) stack.push({ indent, node, type: 'Case' })
        continue
      }
    }

    parent.node.body = parent.node.body ?? []
    parent.node.body.push(node)
    if (trimmed.endsWith(':')) stack.push({ indent, node, type: node.type })
  }

  return ast
}

// ── Statement handlers ───────────────────────────────────────────────────────

function processStatement(node: PyNode, ctx: TraversalContext): BlockResult {
  switch (node.type) {
    case 'FunctionDef':   return processFunction(node, ctx)
    case 'ClassDef':      return processClass(node, ctx)
    case 'If':            return processIf(node, ctx)
    case 'For':           return processFor(node, ctx)
    case 'While':         return processWhile(node, ctx)
    case 'Try':           return processTry(node, ctx)
    case 'With':          return processWith(node, ctx)
    case 'Match':         return processMatch(node, ctx)
    case 'Return':        return processReturn(node, ctx)
    case 'Break':         return processBreak(node, ctx)
    case 'Continue':      return processContinue(node, ctx)
    case 'Raise':         return processRaise(node, ctx)
    case 'Pass':          return { entry: null, exit: ctx.currentNode }
    default:              return processGeneric(node, ctx)
  }
}

function processFunction(node: PyNode, ctx: TraversalContext): BlockResult {
  const fn  = ctx.graph.createNode('subroutine', `def ${node.name}(${node.params})`, 'rounded')
  const end = ctx.graph.createNode('process', `end ${node.name}`, 'rounded')
  const fCtx = ctx.clone(); fCtx.currentNode = fn; fCtx.returnTarget = end
  const r = processBlock(node.body ?? [], fCtx)
  if (r.entry) ctx.graph.connect(fn, r.entry)
  if (r.exit)  ctx.graph.connect(r.exit, end)
  return { entry: fn, exit: end }
}

function processClass(node: PyNode, ctx: TraversalContext): BlockResult {
  const label = node.bases ? `class ${node.name}(${node.bases})` : `class ${node.name}`
  const cls   = ctx.graph.createNode('subroutine', label, 'rounded')
  const cCtx  = ctx.clone(); cCtx.currentNode = cls
  const r     = processBlock(node.body ?? [], cCtx)
  if (r.entry) ctx.graph.connect(cls, r.entry)
  return { entry: cls, exit: r.exit ?? cls }
}

function processIf(node: PyNode, ctx: TraversalContext, sharedMerge?: FlowchartNode): BlockResult {
  const cond  = ctx.graph.createNode('decision', node.test + '?', 'diamond')
  const merge = sharedMerge ?? ctx.graph.createNode('merge' as any, '', 'circle')
  const tCtx  = ctx.clone(); tCtx.currentNode = cond
  const tRes  = processBlock(node.body ?? [], tCtx)
  if (tRes.entry) { ctx.graph.connect(cond, tRes.entry, 'Yes'); if (tRes.exit) ctx.graph.connect(tRes.exit, merge) }
  else ctx.graph.connect(cond, merge, 'Yes')

  const elseBody = node._elseNode?.body ?? null
  const orelse   = node.orelse ?? []

  if (orelse.length && orelse[0].type === 'If') {
    const r = processIf(orelse[0], ctx, merge)
    ctx.graph.connect(cond, r.entry!, 'No')
  } else if (elseBody) {
    const eCtx = ctx.clone(); eCtx.currentNode = cond
    const eRes = processBlock(elseBody, eCtx)
    if (eRes.entry) { ctx.graph.connect(cond, eRes.entry, 'No'); if (eRes.exit) ctx.graph.connect(eRes.exit, merge) }
    else ctx.graph.connect(cond, merge, 'No')
  } else if (orelse.length) {
    const eCtx = ctx.clone(); eCtx.currentNode = cond
    const eRes = processBlock(orelse, eCtx)
    if (eRes.entry) { ctx.graph.connect(cond, eRes.entry, 'No'); if (eRes.exit) ctx.graph.connect(eRes.exit, merge) }
    else ctx.graph.connect(cond, merge, 'No')
  } else {
    ctx.graph.connect(cond, merge, 'No')
  }

  return { entry: cond, exit: merge }
}

function processFor(node: PyNode, ctx: TraversalContext): BlockResult {
  const cond  = ctx.graph.createNode('decision', `${node.target} in ${node.iter}?`, 'diamond')
  const after = ctx.graph.createNode('merge' as any, '', 'circle')
  const lCtx  = ctx.clone(); lCtx.currentNode = cond; lCtx.breakTarget = after; lCtx.continueTarget = cond
  const r     = processBlock(node.body ?? [], lCtx)
  if (r.entry) { ctx.graph.connect(cond, r.entry, 'Yes'); if (r.exit) ctx.graph.connect(r.exit, cond) }
  else ctx.graph.connect(cond, cond, 'Yes')
  if (node.orelse?.body?.length) {
    const eCtx = ctx.clone(); const eRes = processBlock(node.orelse.body, eCtx)
    if (eRes.entry) { ctx.graph.connect(cond, eRes.entry, 'No'); if (eRes.exit) ctx.graph.connect(eRes.exit, after) }
    else ctx.graph.connect(cond, after, 'No')
  } else ctx.graph.connect(cond, after, 'No')
  return { entry: cond, exit: after }
}

function processWhile(node: PyNode, ctx: TraversalContext): BlockResult {
  const cond  = ctx.graph.createNode('decision', node.test + '?', 'diamond')
  const after = ctx.graph.createNode('merge' as any, '', 'circle')
  const lCtx  = ctx.clone(); lCtx.currentNode = cond; lCtx.breakTarget = after; lCtx.continueTarget = cond
  const r     = processBlock(node.body ?? [], lCtx)
  if (r.entry) { ctx.graph.connect(cond, r.entry, 'Yes'); if (r.exit) ctx.graph.connect(r.exit, cond) }
  ctx.graph.connect(cond, after, 'No')
  return { entry: cond, exit: after }
}

function processTry(node: PyNode, ctx: TraversalContext): BlockResult {
  const tryNode = ctx.graph.createNode('process', 'try', 'rounded')
  const after   = ctx.graph.createNode('merge' as any, '', 'circle')
  const tCtx    = ctx.clone(); tCtx.currentNode = tryNode
  const tRes    = processBlock(node.body ?? [], tCtx)
  if (tRes.entry) ctx.graph.connect(tryNode, tRes.entry)
  let finallyNode: FlowchartNode | null = null

  if (node.finalbody?.body) {
    finallyNode = ctx.graph.createNode('process', 'finally', 'rounded')
    const fCtx  = ctx.clone(); fCtx.currentNode = finallyNode
    const fRes  = processBlock(node.finalbody.body, fCtx)
    if (fRes.entry) ctx.graph.connect(finallyNode, fRes.entry)
    ctx.graph.connect(fRes.exit ?? finallyNode, after)
  }

  const target = finallyNode ?? after
  if (tRes.exit) ctx.graph.connect(tRes.exit, target)

  for (const h of (node.handlers ?? [])) {
    const label   = h.exceptionType ? (h.name ? `except ${h.exceptionType} as ${h.name}` : `except ${h.exceptionType}`) : 'except'
    const catchN  = ctx.graph.createNode('process', label, 'rounded')
    ctx.graph.connect(tryNode, catchN, 'error')
    const cCtx = ctx.clone(); cCtx.currentNode = catchN
    const cRes = processBlock(h.body ?? [], cCtx)
    if (cRes.entry) ctx.graph.connect(catchN, cRes.entry)
    ctx.graph.connect(cRes.exit ?? catchN, target)
  }

  return { entry: tryNode, exit: after }
}

function processWith(node: PyNode, ctx: TraversalContext): BlockResult {
  const w    = ctx.graph.createNode('process', `with ${node.items}`, 'rounded')
  const wCtx = ctx.clone(); wCtx.currentNode = w
  const r    = processBlock(node.body ?? [], wCtx)
  if (r.entry) ctx.graph.connect(w, r.entry)
  return { entry: w, exit: r.exit ?? w }
}

function processMatch(node: PyNode, ctx: TraversalContext): BlockResult {
  const match = ctx.graph.createNode('decision', `match ${node.subject}`, 'diamond')
  const after = ctx.graph.createNode('merge' as any, '', 'circle')
  for (const c of (node.cases ?? [])) {
    const label  = c.pattern === '_' ? 'default' : `case ${c.pattern}`
    const caseN  = ctx.graph.createNode('process', label, 'rectangle')
    ctx.graph.connect(match, caseN, c.pattern === '_' ? 'default' : c.pattern)
    const cCtx = ctx.clone(); cCtx.currentNode = caseN
    const r    = processBlock(c.body ?? [], cCtx)
    if (r.entry) ctx.graph.connect(caseN, r.entry)
    ctx.graph.connect(r.exit ?? caseN, after)
  }
  if (!(node.cases?.length)) ctx.graph.connect(match, after)
  return { entry: match, exit: after }
}

function processReturn(node: PyNode, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', node.value ? `return ${node.value}` : 'return', 'rectangle')
  if (ctx.returnTarget) ctx.graph.connect(n, ctx.returnTarget)
  return { entry: n, exit: null }
}
function processBreak(node: PyNode, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', 'break', 'rectangle')
  if (ctx.breakTarget) ctx.graph.connect(n, ctx.breakTarget)
  return { entry: n, exit: null }
}
function processContinue(node: PyNode, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', 'continue', 'rectangle')
  if (ctx.continueTarget) ctx.graph.connect(n, ctx.continueTarget)
  return { entry: n, exit: null }
}
function processRaise(node: PyNode, ctx: TraversalContext): BlockResult {
  const n = ctx.graph.createNode('process', node.exception ? `raise ${node.exception}` : 'raise', 'rectangle')
  return { entry: n, exit: null }
}
function processGeneric(node: PyNode, ctx: TraversalContext): BlockResult {
  let label = node.type === 'Assert' ? `assert ${node.test}` : node.type === 'Import' ? node.statement : node.value ?? node.type
  if ((label ?? '').length > 60) label = label.substring(0, 57) + '...'
  const n = ctx.graph.createNode('process', label, 'rectangle')
  return { entry: n, exit: n }
}

export function processBlock(statements: PyNode[], ctx: TraversalContext): BlockResult {
  const skip = new Set(['Elif', 'Else', 'ExceptHandler', 'Finally', 'Case'])
  const filtered = (statements ?? []).filter(s => !skip.has(s.type))
  if (!filtered.length) return { entry: null, exit: ctx.currentNode }

  let first: FlowchartNode | null = null
  let current = ctx.currentNode

  for (const stmt of filtered) {
    const sCtx = ctx.clone(); sCtx.currentNode = current
    const r    = processStatement(stmt, sCtx)
    if (r.entry) {
      if (!first) first = r.entry
      if (current && current !== ctx.currentNode) ctx.graph.connect(current, r.entry)
      current = r.exit
    }
    if (r.exit === null) return { entry: first, exit: null }
  }

  return { entry: first, exit: current }
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function convertPython(code: string): FlowchartGraph {
  const graph = new FlowchartGraph()
  const start = graph.createNode('start', 'Start', 'circle')
  const end   = graph.createNode('end', 'End', 'circle')
  const ctx   = new TraversalContext(graph); ctx.currentNode = start

  const ast = parsePython(code)
  const r   = processBlock(ast.body ?? [], ctx)

  graph.connect(start, r.entry ?? end)
  if (r.exit) graph.connect(r.exit, end)

  return graph
}
```

- [ ] **6.2 Write `lib/parser/index.ts`** (unified entry point)
```ts
import { convertJS }     from './javascript'
import { convertTS }     from './typescript'
import { convertPython } from './python'
import { graphToMermaid } from './converter'
import type { SupportedLanguage } from './types'

export function codeToMermaid(code: string, language: SupportedLanguage): string {
  const graph = language === 'python' ? convertPython(code)
              : language === 'typescript' ? convertTS(code)
              : convertJS(code)
  return graphToMermaid(graph)
}

export * from './types'
export { graphToMermaid } from './converter'
```

- [ ] **6.3 Install Jest + ts-jest**
```bash
npm install -D jest ts-jest @types/jest
```
Add to `package.json` scripts:
```json
"test": "jest"
```
Create `jest.config.js`:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}
```

- [ ] **6.4 Write parser tests `__tests__/parser.test.ts`**
```ts
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
```

- [ ] **6.5 Run tests**
```bash
npm test
# Expected: 8 tests pass
```

- [ ] **6.6 Commit**
```bash
git add lib/parser/ __tests__/ jest.config.js package.json
git commit -m "feat: migrate Python parser to TypeScript, add Jest tests"
```

---

**Plan 2 complete. Proceed to `plan-3-api.md`.**
