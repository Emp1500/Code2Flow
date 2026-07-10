/* eslint-disable @typescript-eslint/no-explicit-any */
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
    case 'Super':              text = 'super'; break
    default: text = n.type ?? '[expr]'
  }
  return text.length > maxLen ? text.substring(0, maxLen - 3) + '...' : text
}

// ── Parser ──────────────────────────────────────────────────────────────────

export function parseJS(code: string): acorn.Program {
  try {
    return acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    }) as acorn.Program
  } catch (e: any) {
    throw new Error(`JavaScript Parse Error at line ${e.loc?.line ?? '?'}: ${e.message}`)
  }
}

// ── Helper functions ────────────────────────────────────────────────────────

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
    case 'ClassDeclaration':    return processClassJS(node, ctx)
    // TypeScript: unwrap exports so the exported declaration still renders
    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
      return node.declaration ? processStatement(node.declaration, ctx) : { entry: null, exit: ctx.currentNode }
    // TypeScript: type-only declarations have no runtime control flow
    case 'TSInterfaceDeclaration':
    case 'TSTypeAliasDeclaration':
    case 'TSDeclareFunction':
    case 'TSModuleDeclaration':
    case 'ImportDeclaration':
      return { entry: null, exit: ctx.currentNode }
    default: {
      const n = ctx.graph.createNode('process', node.type.replace('Statement', ''), 'rectangle')
      return { entry: n, exit: n }
    }
  }
}

function processFunction(node: any, ctx: TraversalContext): BlockResult {
  const name = node.id?.name ?? 'anonymous'
  const params = node.params.map((p: any) => formatExpression(p)).join(', ')
  return processFunctionBody(`function ${name}(${params})`, `end ${name}`, node.body.body, ctx)
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
    if (r.exit) {
      if (update) { ctx.graph.connect(r.exit, update); ctx.graph.connect(update, cond) }
      else ctx.graph.connect(r.exit, cond)
    }
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
  if (!node.cases.some((c: any) => !c.test)) ctx.graph.connect(sw, after, 'no match')
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
  if (!node.declarations.some((d: any) => isBlockFunction(d.init) || d.init?.type === 'ClassExpression')) {
    const decls = node.declarations.map((d: any) => {
      const name = formatExpression(d.id)
      return d.init ? `${name} = ${formatExpression(d.init)}` : name
    }).join(', ')
    const n = ctx.graph.createNode('process', `${node.kind} ${decls}`, 'rectangle')
    return { entry: n, exit: n }
  }
  // At least one declarator holds a function with a block body or class expression:
  // render each declarator separately so the function's/class's control flow stays visible.
  let first: FlowchartNode | null = null
  let prev: FlowchartNode | null = null
  for (const d of node.declarations) {
    const name = formatExpression(d.id)
    let r: BlockResult
    if (d.init?.type === 'ClassExpression') {
      r = processClassJS({ ...d.init, id: d.init.id ?? d.id }, ctx)
    } else if (isBlockFunction(d.init)) {
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

function processExpression(node: any, ctx: TraversalContext): BlockResult {
  const expr = node.expression
  if (expr.type === 'AssignmentExpression' && expr.operator === '=' && isBlockFunction(expr.right)) {
    const target = formatExpression(expr.left)
    return processFunctionBody(functionLabel(target, expr.right), `end ${target}`, expr.right.body.body, ctx)
  }
  const n = ctx.graph.createNode('process', formatExpression(expr), 'rectangle')
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
