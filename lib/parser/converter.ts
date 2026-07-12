import type { FlowchartGraph } from './types'

function escapeLabel(text: string): string {
  return (text || '')
    .replace(/"/g, "'")
    .replace(/\|/g, '/')
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
    if (edge.label) out += `    ${edge.from} -->|${escapeLabel(edge.label)}| ${edge.to}\n`
    else            out += `    ${edge.from} --> ${edge.to}\n`
  }

  return out
}
