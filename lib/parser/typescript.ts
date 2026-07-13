import * as acorn from 'acorn'
import * as acornTypescript from 'acorn-typescript'
import { processBlock } from './javascript'
import { FlowchartGraph, TraversalContext } from './types'

// Under `import * as x`, TS's CJS interop helper can clobber `.default` with
// the whole module object when the source has no `__esModule` marker — the
// named `tsPlugin` export is unambiguous across bundlers (webpack vs ts-jest).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- targeted CJS-interop cast, see comment above
const tsPlugin = (acornTypescript as any).tsPlugin as typeof import('acorn-typescript').tsPlugin

// acorn-typescript's plugin factory returns a parser mixin typed against its
// own internal `AcornParseClass` (see its middleware.d.ts), which acorn's
// `Parser.extend` signature doesn't structurally recognize — a real type
// mismatch between the two packages' own .d.ts files, not something this
// module can resolve without patching either library.
type ExtendPlugin = Parameters<typeof acorn.Parser.extend>[0]
const TSParser = acorn.Parser.extend(tsPlugin() as unknown as ExtendPlugin)

// A parse error thrown by acorn/acorn-typescript: a SyntaxError-shaped
// object with a non-standard `loc` position attached.
interface AcornParseError {
  message: string
  loc?: { line: number; column: number } | null
}

function parseTSCode(code: string): acorn.Program {
  try {
    return TSParser.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    } as acorn.Options) as unknown as acorn.Program
  } catch (e) {
    const err = e as AcornParseError
    throw new Error(`TypeScript Parse Error at line ${err.loc?.line ?? '?'}: ${err.message}`)
  }
}

export function convertTS(code: string): FlowchartGraph {
  const graph = new FlowchartGraph()
  const start = graph.createNode('start', 'Start', 'circle')
  const end   = graph.createNode('end', 'End', 'circle')
  const ctx   = new TraversalContext(graph)
  ctx.currentNode = start

  const ast = parseTSCode(code)
  const r   = processBlock(ast.body as Parameters<typeof processBlock>[0], ctx)

  graph.connect(start, r.entry ?? end)
  if (r.exit) graph.connect(r.exit, end)

  return graph
}
