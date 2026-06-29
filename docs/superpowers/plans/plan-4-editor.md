# Plan 4: Dashboard + Editor UI

> **Prereq:** plan-3-api.md complete (API routes live, Supabase schema applied).

**Goal:** Landing page, protected layout, dashboard grid, full editor with Monaco + Mermaid, resizable panels, and the file-operations toolbar.

---

## Task 12: Landing Page + Layout

**Files:** `app/page.tsx`, `components/layout/Navbar.tsx`, `components/layout/Footer.tsx`

- [ ] **12.1 Write `components/layout/Navbar.tsx`**
```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function Navbar({ user }: { user: { email?: string } | null }) {
  const router   = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg tracking-tight">Code2Flow</Link>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link href="/register"><Button size="sm">Get started</Button></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **12.2 Write `app/page.tsx`** (landing)
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'

export default async function LandingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Turn code into flowcharts — instantly
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Paste JavaScript, TypeScript, or Python. Code2Flow generates a live flowchart as you type.
          Save, share, and version your diagrams.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href={user ? '/editor' : '/register'}>
            <Button size="lg">Start for free</Button>
          </Link>
          {user && (
            <Link href="/dashboard">
              <Button variant="outline" size="lg">My flowcharts</Button>
            </Link>
          )}
        </div>
        <div className="mt-20 grid grid-cols-3 gap-8 text-left">
          {[
            { title: 'Instant preview', desc: 'Flowchart updates as you type with 250ms debounce.' },
            { title: 'Version history', desc: 'Every save creates a version. Restore any previous state.' },
            { title: 'Public sharing', desc: 'Toggle a link to share read-only views with anyone.' },
          ].map(f => (
            <div key={f.title} className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **12.3 Commit**
```bash
git add app/page.tsx components/layout/
git commit -m "feat: add landing page and Navbar"
```

---

## Task 13: Protected Layout + Dashboard

**Files:** `app/(protected)/layout.tsx`, `components/dashboard/FlowchartCard.tsx`, `components/dashboard/FlowchartGrid.tsx`, `app/(protected)/dashboard/page.tsx`

- [ ] **13.1 Write `app/(protected)/layout.tsx`**
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
```

- [ ] **13.2 Write `components/dashboard/FlowchartCard.tsx`**
```tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Flowchart } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function FlowchartCard({ flowchart }: { flowchart: Flowchart }) {
  const router   = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm(`Delete "${flowchart.title}"?`)) return
    setDeleting(true)
    await fetch(`/api/flowcharts/${flowchart.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <Link href={`/editor/${flowchart.id}`}
      className="group block border rounded-lg p-4 hover:border-primary transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium truncate">{flowchart.title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary">{flowchart.language}</Badge>
          {flowchart.is_public && <Badge variant="outline">Public</Badge>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {new Date(flowchart.updated_at).toLocaleDateString()}
      </p>
      <Button
        variant="destructive" size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDelete} disabled={deleting}
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </Button>
    </Link>
  )
}
```

- [ ] **13.3 Write `app/(protected)/dashboard/page.tsx`**
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FlowchartCard } from '@/components/dashboard/FlowchartCard'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } }  = await supabase.auth.getUser()
  const { data: flowcharts } = await supabase
    .from('flowcharts')
    .select('*')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">My Flowcharts</h1>
          <Link href="/editor">
            <Button>New flowchart</Button>
          </Link>
        </div>
        {!flowcharts?.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="mb-4">No flowcharts yet.</p>
            <Link href="/editor"><Button>Create your first</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flowcharts.map(fc => <FlowchartCard key={fc.id} flowchart={fc} />)}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **13.4 Commit**
```bash
git add app/\(protected\)/ components/dashboard/
git commit -m "feat: add protected layout and dashboard page"
```

---

## Task 14: Editor Core (Monaco + Mermaid + Panels)

**Files:** `components/editor/CodeEditor.tsx`, `components/editor/FlowchartPanel.tsx`, `components/editor/EditorLayout.tsx`

- [ ] **14.1 Write `components/editor/CodeEditor.tsx`**
```tsx
'use client'
import { useRef } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import type { SupportedLanguage } from '@/lib/parser'

interface Props {
  value: string
  language: SupportedLanguage
  onChange: (value: string) => void
  onEditorMount?: (editor: editor.IStandaloneCodeEditor) => void
}

export function CodeEditor({ value, language, onChange, onEditorMount }: Props) {
  const monacoLang = language === 'python' ? 'python' : 'typescript'

  return (
    <MonacoEditor
      height="100%"
      language={monacoLang}
      value={value}
      theme="vs-dark"
      onChange={v => onChange(v ?? '')}
      onMount={onEditorMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        tabSize: 2,
      }}
    />
  )
}
```

- [ ] **14.2 Write `components/editor/FlowchartPanel.tsx`**
```tsx
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
```

- [ ] **14.3 Write `components/editor/EditorLayout.tsx`**
```tsx
'use client'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface Props {
  left:  React.ReactNode
  right: React.ReactNode
}

export function EditorLayout({ left, right }: Props) {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={50} minSize={20}>
        {left}
      </Panel>
      <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />
      <Panel defaultSize={50} minSize={20}>
        {right}
      </Panel>
    </PanelGroup>
  )
}
```

- [ ] **14.4 Commit**
```bash
git add components/editor/CodeEditor.tsx components/editor/FlowchartPanel.tsx components/editor/EditorLayout.tsx
git commit -m "feat: add Monaco editor, Mermaid panel, resizable layout"
```

---

## Task 15: Editor Pages + Toolbar

**Files:** `app/(protected)/editor/page.tsx`, `app/(protected)/editor/[id]/page.tsx`, `components/editor/EditorToolbar.tsx`

- [ ] **15.1 Write `components/editor/EditorToolbar.tsx`**
```tsx
'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { editor } from 'monaco-editor'
import type { SupportedLanguage } from '@/lib/parser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface Props {
  flowchartId?: string
  title: string
  language: SupportedLanguage
  isPublic: boolean
  shareId: string | null
  hasUnsavedChanges: boolean
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>
  code: string
  onSave: () => Promise<void>
  onSaveAs: () => Promise<void>
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
  onToggleShare: () => Promise<void>
  onDownloadPng: () => void
  onLanguageChange: (lang: SupportedLanguage) => void
  onVersionHistory: () => void
}

export function EditorToolbar({
  flowchartId, title, language, isPublic, shareId, hasUnsavedChanges,
  editorRef, code,
  onSave, onSaveAs, onRename, onDelete, onToggleShare, onDownloadPng,
  onLanguageChange, onVersionHistory,
}: Props) {
  const router  = useRouter()
  const [editing, setEditing]     = useState(false)
  const [titleVal, setTitleVal]   = useState(title)
  const [saving, setSaving]       = useState(false)

  async function handleSave() {
    setSaving(true); await onSave(); setSaving(false)
  }

  async function handleRenameBlur() {
    setEditing(false)
    if (titleVal.trim() && titleVal !== title) await onRename(titleVal.trim())
  }

  async function handleNew() {
    if (hasUnsavedChanges) {
      const choice = confirm('Save before leaving?')
      if (choice) await onSave()
    }
    router.push('/editor')
  }

  async function handleDelete() {
    if (!confirm(`Delete "${title}"?`)) return
    await onDelete()
    router.push('/dashboard')
  }

  function handleShareCopy() {
    if (shareId) {
      navigator.clipboard.writeText(`${window.location.origin}/share/${shareId}`)
    }
  }

  return (
    <header className="h-12 border-b border-border bg-background flex items-center px-3 gap-2 shrink-0">
      {/* File operations */}
      <Button variant="ghost" size="sm" onClick={handleNew}>New</Button>
      <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : hasUnsavedChanges ? 'Save*' : 'Save'}
      </Button>
      <Button variant="ghost" size="sm" onClick={onSaveAs}>Save As</Button>

      {/* Title */}
      {editing ? (
        <Input
          className="h-7 w-48 text-sm"
          value={titleVal}
          onChange={e => setTitleVal(e.target.value)}
          onBlur={handleRenameBlur}
          onKeyDown={e => { if (e.key === 'Enter') handleRenameBlur() }}
          autoFocus
        />
      ) : (
        <button
          className="text-sm font-medium px-2 py-1 rounded hover:bg-accent transition-colors max-w-48 truncate"
          onClick={() => setEditing(true)}
          title="Click to rename"
        >
          {title}{hasUnsavedChanges ? ' *' : ''}
        </button>
      )}

      <div className="flex-1" />

      {/* Edit */}
      <Button variant="ghost" size="sm" onClick={() => editorRef.current?.trigger('', 'undo', null)}>Undo</Button>
      <Button variant="ghost" size="sm" onClick={() => editorRef.current?.trigger('', 'redo', null)}>Redo</Button>

      {/* Language */}
      <Select value={language} onValueChange={v => onLanguageChange(v as SupportedLanguage)}>
        <SelectTrigger className="h-7 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="javascript">JavaScript</SelectItem>
          <SelectItem value="typescript">TypeScript</SelectItem>
          <SelectItem value="python">Python</SelectItem>
        </SelectContent>
      </Select>

      {/* View */}
      <Button variant="ghost" size="sm" onClick={onVersionHistory}>History</Button>

      {/* Share */}
      {flowchartId && (
        <Button variant="ghost" size="sm" onClick={async () => { await onToggleShare(); if (!isPublic) handleShareCopy() }}>
          {isPublic ? 'Unshare' : 'Share'}
        </Button>
      )}
      {isPublic && shareId && (
        <Button variant="ghost" size="sm" onClick={handleShareCopy}>Copy link</Button>
      )}

      {/* Export */}
      <Button variant="ghost" size="sm" onClick={onDownloadPng}>PNG</Button>

      {/* Delete */}
      {flowchartId && (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDelete}>Delete</Button>
      )}
    </header>
  )
}
```

- [ ] **15.2 Write `app/(protected)/editor/page.tsx`** (new flowchart)
```tsx
'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { editor } from 'monaco-editor'
import { CodeEditor }    from '@/components/editor/CodeEditor'
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
  const router   = useRouter()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const panelRef  = useRef<HTMLDivElement>(null)

  const [language, setLanguage]   = useState<SupportedLanguage>('javascript')
  const [code, setCode]           = useState(DEFAULT_CODE.javascript)
  const [mermaid, setMermaid]     = useState('')
  const [title, setTitle]         = useState('Untitled')
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    try { setMermaid(codeToMermaid(code, language)) } catch {}
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
          right={<FlowchartPanel mermaidCode={mermaid} panelRef={panelRef} />}
        />
      </div>
      {showVersions && <VersionDrawer flowchartId="" onClose={() => setShowVersions(false)} onRestore={setCode} />}
    </div>
  )
}
```

- [ ] **15.3 Write `app/(protected)/editor/[id]/page.tsx`** (existing flowchart)
```tsx
'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { editor } from 'monaco-editor'
import { CodeEditor }    from '@/components/editor/CodeEditor'
import { FlowchartPanel } from '@/components/editor/FlowchartPanel'
import { EditorLayout }   from '@/components/editor/EditorLayout'
import { EditorToolbar }  from '@/components/editor/EditorToolbar'
import { VersionDrawer }  from '@/components/editor/VersionDrawer'
import { codeToMermaid }  from '@/lib/parser'
import type { SupportedLanguage } from '@/lib/parser'
import { toPng } from 'html-to-image'

export default function EditFlowchartPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const panelRef  = useRef<HTMLDivElement>(null)

  const [loaded, setLoaded]         = useState(false)
  const [title, setTitle]           = useState('Untitled')
  const [language, setLanguage]     = useState<SupportedLanguage>('javascript')
  const [code, setCode]             = useState('')
  const [savedCode, setSavedCode]   = useState('')
  const [isPublic, setIsPublic]     = useState(false)
  const [shareId, setShareId]       = useState<string | null>(null)
  const [mermaid, setMermaid]       = useState('')
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
    try { setMermaid(codeToMermaid(code, language)) } catch {}
  }, [code, language, loaded])

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); handleSaveAs() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); handleNew() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); setShowVersions(v => !v) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); handleDownloadPng() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [code, title, language]) // eslint-disable-line

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
    const res = await fetch(`/api/flowcharts/${id}/share`, { method: 'POST' })
    const data = await res.json()
    setIsPublic(data.is_public); setShareId(data.share_id)
  }, [id])

  function handleNew() {
    if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return
    router.push('/editor')
  }

  function handleDownloadPng() {
    if (!panelRef.current) return
    toPng(panelRef.current).then(url => {
      const a = document.createElement('a'); a.href = url; a.download = `${title}-flowchart.png`; a.click()
    })
  }

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
          right={<FlowchartPanel mermaidCode={mermaid} panelRef={panelRef} />}
        />
      </div>
      {showVersions && (
        <VersionDrawer flowchartId={id} onClose={() => setShowVersions(false)}
          onRestore={c => { setCode(c); setSavedCode(c) }} />
      )}
    </div>
  )
}
```

- [ ] **15.4 Commit**
```bash
git add app/\(protected\)/editor/ components/editor/EditorToolbar.tsx
git commit -m "feat: add editor pages with toolbar, keyboard shortcuts"
```

---

## Verification

```bash
npm run dev
# 1. http://localhost:3000              → landing page
# 2. http://localhost:3000/login        → login form
# 3. Login → redirects to /dashboard
# 4. /dashboard → shows "No flowcharts yet"
# 5. Click "New flowchart" → /editor → Monaco loads, flowchart renders
# 6. Type code → flowchart updates live
# 7. Click Save → creates flowchart, URL changes to /editor/[id]
# 8. Ctrl+S → saves and creates version
# 9. Click title → inline rename works
```

**Plan 4 complete. Proceed to `plan-5-features.md`.**
