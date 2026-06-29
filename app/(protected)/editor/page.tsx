'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { editor } from 'monaco-editor'
import { CodeEditor }     from '@/components/editor/CodeEditor'
import { FlowchartPanel } from '@/components/editor/FlowchartPanel'
import { EditorLayout }   from '@/components/editor/EditorLayout'
import { EditorToolbar }  from '@/components/editor/EditorToolbar'
import { VersionDrawer }  from '@/components/editor/VersionDrawer'
import { codeToMermaid }  from '@/lib/parser'
import type { SupportedLanguage } from '@/lib/parser'
import { toPng } from 'html-to-image'

const DEFAULT_CODE: Record<SupportedLanguage, string> = {
  javascript: `function greet(name) {\n  if (name) {\n    return "Hello, " + name;\n  } else {\n    return "Hello, World!";\n  }\n}`,
  typescript: `function greet(name: string): string {\n  if (name) {\n    return \`Hello, \${name}\`;\n  } else {\n    return "Hello, World!";\n  }\n}`,
  python:     `def greet(name):\n    if name:\n        return f"Hello, {name}"\n    else:\n        return "Hello, World!"`,
}

export default function NewEditorPage() {
  const router    = useRouter()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const panelRef  = useRef<HTMLDivElement>(null)

  const [language, setLanguage]         = useState<SupportedLanguage>('javascript')
  const [code, setCode]                 = useState(DEFAULT_CODE.javascript)
  const [mermaidCode, setMermaidCode]   = useState('')
  const [title, setTitle]               = useState('Untitled')
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    try { setMermaidCode(codeToMermaid(code, language)) } catch {}
  }, [code, language])

  const handleSave = useCallback(async () => {
    const res = await fetch('/api/flowcharts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, code, language }),
    })
    if (res.ok) {
      const fc = await res.json()
      router.replace(`/editor/${fc.id}`)
    }
  }, [title, code, language, router])

  const handleSaveAs = useCallback(async () => {
    const newTitle = prompt('Title for new flowchart:', title + ' (copy)')
    if (!newTitle) return
    const res = await fetch('/api/flowcharts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, code, language }),
    })
    if (res.ok) { const fc = await res.json(); router.push(`/editor/${fc.id}`) }
  }, [title, code, language, router])

  function handleDownloadPng() {
    if (!panelRef.current) return
    toPng(panelRef.current).then(url => {
      const a = document.createElement('a'); a.href = url; a.download = `${title}-flowchart.png`; a.click()
    })
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        title={title} language={language} isPublic={false} shareId={null}
        hasUnsavedChanges={false} editorRef={editorRef} code={code}
        onSave={handleSave} onSaveAs={handleSaveAs}
        onRename={async t => setTitle(t)}
        onDelete={async () => router.push('/dashboard')}
        onToggleShare={async () => {}}
        onDownloadPng={handleDownloadPng}
        onLanguageChange={lang => { setLanguage(lang); setCode(DEFAULT_CODE[lang]) }}
        onVersionHistory={() => setShowVersions(true)}
      />
      <div className="flex-1 overflow-hidden">
        <EditorLayout
          left={<CodeEditor value={code} language={language} onChange={setCode} onEditorMount={e => { editorRef.current = e }} />}
          right={<FlowchartPanel mermaidCode={mermaidCode} panelRef={panelRef} />}
        />
      </div>
      {showVersions && <VersionDrawer flowchartId="" onClose={() => setShowVersions(false)} onRestore={setCode} />}
    </div>
  )
}
