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

  /**
   * Removes internal junction nodes ('merge') that never received an
   * incoming edge — e.g. when every branch of an if/elif/else terminates
   * (return/break/continue/raise), the shared merge point is never reached.
   * Left in place, these render as disconnected circles with a stray
   * outgoing edge. Iterates to a fixed point since removing one orphan can
   * orphan another (e.g. chained elif merge points).
   */
  pruneOrphanJunctions(): void {
    let changed = true
    while (changed) {
      changed = false
      const incoming = new Set(this.edges.map(e => e.to))
      const orphan = this.nodes.find(n => n.type === 'merge' && !incoming.has(n.id))
      if (orphan) {
        this.nodes = this.nodes.filter(n => n.id !== orphan.id)
        this.edges = this.edges.filter(e => e.from !== orphan.id && e.to !== orphan.id)
        changed = true
      }
    }
  }
}

export class TraversalContext {
  currentNode: FlowchartNode | null = null
  breakTarget: FlowchartNode | null = null
  continueTarget: FlowchartNode | null = null
  returnTarget: FlowchartNode | null = null
  labeledTargets: Record<string, { break: FlowchartNode | null; continue: FlowchartNode | null }> = {}
  pendingLabels: string[] = []
  throwTarget: FlowchartNode | null = null

  constructor(public graph: FlowchartGraph) {}

  clone(): TraversalContext {
    const ctx = new TraversalContext(this.graph)
    ctx.currentNode = this.currentNode
    ctx.breakTarget = this.breakTarget
    ctx.continueTarget = this.continueTarget
    ctx.returnTarget = this.returnTarget
    ctx.labeledTargets = { ...this.labeledTargets }
    ctx.pendingLabels = [...this.pendingLabels]
    ctx.throwTarget = this.throwTarget
    return ctx
  }
}

export interface BlockResult {
  entry: FlowchartNode | null
  exit: FlowchartNode | null
}
