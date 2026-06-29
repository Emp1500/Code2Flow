'use client'
import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'dark', flowchart: { useMaxWidth: true, curve: 'basis' } })

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
    const id = `mermaid-${Date.now()}-${idRef.current++}`
    mermaid.render(id, mermaidCode)
      .then(({ svg }) => { setSvg(svg); setError('') })
      .catch(err => setError(err.message))
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
