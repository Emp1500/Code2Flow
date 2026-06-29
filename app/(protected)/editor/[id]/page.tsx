'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { editor } from 'monaco-editor'
import { CodeEditor }     from '@/components/editor/CodeEditor'
import { FlowchartPanel } from '@/components/editor/FlowchartPanel'
import { EditorLayout }   from '@/components/editor/EditorLayout'
import { EditorToolbar }  from '@/components/editor/EditorToolbar'
import { VersionDrawer }  from '@/components/editor/VersionDrawer'
import { codeToMermaid }  from '@/lib/parser'
import type { SupportedLanguage } from '@/lib/parser'
import { toPng } from 'html-to-image'

export default function EditFlowchartPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const panelRef  = useRef<HTMLDivElement>(null)

  const [loaded, setLoaded]             = useState(false)
  const [title, setTitle]               = useState('Untitled')
  const [language, setLanguage]         = useState<SupportedLanguage>('javascript')
  const [code, setCode]                 = useState('')
  const [savedCode, setSavedCode]       = useState('')
  const [isPublic, setIsPublic]         = useState(false)
  const [shareId, setShareId]           = useState<string | null>(null)
  const [mermaidCode, setMermaidCode]   = useState('')
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    fetch(`/api/flowcharts/${id}`)
      .then(r => r.json())
      .then(fc => {
        setTitle(fc.title); setLanguage(fc.language); setCode(fc.code ?? '')
        setSavedCode(fc.code ?? ''); setIsPublic(fc.is_public); setShareId(fc.share_id)
        setLoaded(true)
      })
  }, [id])

  useEffect(() => {
    if (!loaded) return
    try { setMermaidCode(codeToMermaid(code, language)) } catch {}
  }, [code, language, loaded])

  const hasUnsavedChanges = code !== savedCode

  const handleSave = useCallback(async () => {
    await fetch(`/api/flowcharts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language }),
    })
    setSavedCode(code)
  }, [id, code, language])

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

  const handleRename = useCallback(async (newTitle: string) => {
    setTitle(newTitle)
    await fetch(`/api/flowcharts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
    document.title = `${newTitle} — Code2Flow`
  }, [id])

  const handleDelete = useCallback(async () => {
    await fetch(`/api/flowcharts/${id}`, { method: 'DELETE' })
    router.push('/dashboard')
  }, [id, router])

  const handleToggleShare = useCallback(async () => {
    const res  = await fetch(`/api/flowcharts/${id}/share`, { method: 'POST' })
    const data = await res.json()
    setIsPublic(data.is_public); setShareId(data.share_id)
  }, [id])

  function handleDownloadPng() {
    if (!panelRef.current) return
    toPng(panelRef.current).then(url => {
      const a = document.createElement('a'); a.href = url; a.download = `${title}-flowchart.png`; a.click()
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); handleSaveAs() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); setShowVersions(v => !v) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); handleDownloadPng() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSave, handleSaveAs])

  if (!loaded) return <div className="h-screen flex items-center justify-center text-muted-foreground">Loading…</div>

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        flowchartId={id} title={title} language={language}
        isPublic={isPublic} shareId={shareId}
        hasUnsavedChanges={hasUnsavedChanges} editorRef={editorRef} code={code}
        onSave={handleSave} onSaveAs={handleSaveAs} onRename={handleRename}
        onDelete={handleDelete} onToggleShare={handleToggleShare}
        onDownloadPng={handleDownloadPng}
        onLanguageChange={lang => setLanguage(lang)}
        onVersionHistory={() => setShowVersions(v => !v)}
      />
      <div className="flex-1 overflow-hidden">
        <EditorLayout
          left={<CodeEditor value={code} language={language} onChange={setCode} onEditorMount={e => { editorRef.current = e }} />}
          right={<FlowchartPanel mermaidCode={mermaidCode} panelRef={panelRef} />}
        />
      </div>
      {showVersions && (
        <VersionDrawer flowchartId={id} onClose={() => setShowVersions(false)}
          onRestore={c => { setCode(c); setSavedCode(c) }} />
      )}
    </div>
  )
}
