/* eslint-disable @typescript-eslint/no-explicit-any */
import * as acorn from 'acorn'
import * as acornTypescript from 'acorn-typescript'
import { processBlock } from './javascript'
import { FlowchartGraph, TraversalContext } from './types'

// Under `import * as x`, TS's CJS interop helper can clobber `.default` with
// the whole module object when the source has no `__esModule` marker — the
// named `tsPlugin` export is unambiguous across bundlers (webpack vs ts-jest).
const tsPlugin = (acornTypescript as any).tsPlugin as typeof import('acorn-typescript').tsPlugin

const TSParser = acorn.Parser.extend(tsPlugin() as any)

function parseTSCode(code: string): acorn.Program {
  try {
    return TSParser.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    } as any) as unknown as acorn.Program
  } catch (e: any) {
    throw new Error(`TypeScript Parse Error at line ${e.loc?.line ?? '?'}: ${e.message}`)
  }
}

export function convertTS(code: string): FlowchartGraph {
  const graph = new FlowchartGraph()
  const start = graph.createNode('start', 'Start', 'circle')
  const end   = graph.createNode('end', 'End', 'circle')
  const ctx   = new TraversalContext(graph)
  ctx.currentNode = start

  const ast = parseTSCode(code)
  const r   = processBlock((ast as any).body, ctx)

  graph.connect(start, r.entry ?? end)
  if (r.exit) graph.connect(r.exit, end)

  return graph
}
