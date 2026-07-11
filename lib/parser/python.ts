/* eslint-disable @typescript-eslint/no-explicit-any */
import { FlowchartGraph, TraversalContext, type BlockResult, type FlowchartNode } from './types'
import { toLogicalLines } from './python-lines'

// ── Tokenizer ────────────────────────────────────────────────────────────────

interface PyNode { type: string; body?: PyNode[]; [key: string]: any }

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
  const ast: PyNode = { type: 'Program', body: [] }
  const stack: Array<{ indent: number; node: PyNode; type: string }> = [{ indent: -1, node: ast, type: 'program' }]

  for (const ll of toLogicalLines(code)) {
    const trimmed = ll.text
    const indent = ll.indent

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1]
    const node   = parseLine(trimmed, ll.lineNum)
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
