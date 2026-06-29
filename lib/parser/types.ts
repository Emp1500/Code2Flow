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
