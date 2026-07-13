'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toPng } from 'html-to-image'
import { codeToMermaid } from '@/lib/parser'
import type { SupportedLanguage } from '@/lib/parser'
import { FlowchartPanel } from '@/components/editor/FlowchartPanel'
import { EditorLayout }   from '@/components/editor/EditorLayout'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading editor…</div>,
})

interface Props {
  flowchart: { id: string; title: string; language: string; code: string; share_id: string | null }
  currentUserId: string | null
}

export function ShareView({ flowchart, currentUserId }: Props) {
  const router   = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const [mermaid, setMermaid] = useState('')

  const language = flowchart.language as SupportedLanguage

  useEffect(() => {
    try { setMermaid(codeToMermaid(flowchart.code, language)) } catch {}
  }, [flowchart.code, language])

  async function handleFork() {
    const res = await fetch('/api/flowcharts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${flowchart.title} (fork)`,
        code: flowchart.code,
        language,
      }),
    })
    if (res.ok) { const fc = await res.json(); router.push(`/editor/${fc.id}`) }
  }

  function handleDownload() {
    if (!panelRef.current) return
    toPng(panelRef.current).then(url => {
      const a = document.createElement('a'); a.href = url; a.download = `${flowchart.title}-flowchart.png`; a.click()
    })
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <span className="font-medium truncate">{flowchart.title}</span>
        <Badge variant="secondary">{language}</Badge>
        <Badge variant="outline">Read-only</Badge>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={handleDownload}>Download PNG</Button>
        {currentUserId && (
          <Button size="sm" onClick={handleFork}>Fork to my account</Button>
        )}
      </header>
      <div className="flex-1 overflow-hidden">
        <EditorLayout
          left={
            <MonacoEditor
              height="100%" language={language === 'python' ? 'python' : 'typescript'}
              value={flowchart.code} theme="vs-dark"
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14 }}
            />
          }
          right={<FlowchartPanel mermaidCode={mermaid} panelRef={panelRef} />}
        />
      </div>
    </div>
  )
}
