'use client'
import { useEffect, useRef, useState } from 'react'
import type MermaidType from 'mermaid'

// Deferred so `mermaid` isn't bundled into the initial route chunk — it's
// only fetched once this panel actually mounts and renders a diagram.
let mermaidPromise: Promise<typeof MermaidType> | null = null
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(m => {
      m.default.initialize({ startOnLoad: false, theme: 'dark', flowchart: { useMaxWidth: true, curve: 'basis' } })
      return m.default
    })
  }
  return mermaidPromise
}

interface Props {
  mermaidCode: string
  panelRef?: React.RefObject<HTMLDivElement>
}

export function FlowchartPanel({ mermaidCode, panelRef }: Props) {
  const [svg, setSvg]     = useState('')
  const [error, setError] = useState('')
  const idRef = useRef(0)

  useEffect(() => {
    if (!mermaidCode) return
    let cancelled = false
    const id = `mermaid-${Date.now()}-${idRef.current++}`
    loadMermaid()
      .then(mermaid => mermaid.render(id, mermaidCode))
      .then(({ svg }) => { if (!cancelled) { setSvg(svg); setError('') } })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [mermaidCode])

  return (
    <div ref={panelRef} className="h-full w-full overflow-auto bg-[#1e1e1e] flex items-start justify-center p-8">
      {error ? (
        <pre className="text-red-400 text-sm font-mono whitespace-pre-wrap">{error}</pre>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: svg }} className="max-w-full" />
      )}
    </div>
  )
}
