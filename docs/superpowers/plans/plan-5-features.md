# Plan 5: Advanced Features — Share View, Version Drawer, Command Palette

> **Prereq:** plan-4-editor.md complete.

**Goal:** Public share view, version history drawer, and Ctrl+K command palette.

---

## Task 16: Public Share View

**Files:** `app/share/[shareId]/page.tsx`, `components/share/ShareView.tsx`

- [ ] **16.1 Write `app/share/[shareId]/page.tsx`**
```tsx
import { notFound }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShareView }    from '@/components/share/ShareView'

export default async function SharePage({ params }: { params: { shareId: string } }) {
  const supabase = createClient()

  const { data: fc } = await supabase
    .from('flowcharts')
    .select('id, title, language, share_id, user_id')
    .eq('share_id', params.shareId)
    .eq('is_public', true)
    .single()

  if (!fc) notFound()

  const { data: version } = await supabase
    .from('flowchart_versions')
    .select('code')
    .eq('flowchart_id', fc.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <ShareView
      flowchart={{ ...fc, code: version?.code ?? '' }}
      currentUserId={user?.id ?? null}
    />
  )
}
```

- [ ] **16.2 Write `components/share/ShareView.tsx`**
```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import MonacoEditor from '@monaco-editor/react'
import { toPng } from 'html-to-image'
import { codeToMermaid } from '@/lib/parser'
import type { SupportedLanguage } from '@/lib/parser'
import { FlowchartPanel } from '@/components/editor/FlowchartPanel'
import { EditorLayout }   from '@/components/editor/EditorLayout'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'

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
```

- [ ] **16.3 Commit**
```bash
git add app/share/ components/share/
git commit -m "feat: add public share view with fork support"
```

---

## Task 17: Version History Drawer

**File:** `components/editor/VersionDrawer.tsx`

- [ ] **17.1 Write `components/editor/VersionDrawer.tsx`**
```tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { FlowchartVersion } from '@/types'

interface Props {
  flowchartId: string
  onClose: () => void
  onRestore: (code: string) => void
}

export function VersionDrawer({ flowchartId, onClose, onRestore }: Props) {
  const [versions, setVersions] = useState<Omit<FlowchartVersion, 'code'>[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [preview,  setPreview]  = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!flowchartId) { setLoading(false); return }
    fetch(`/api/flowcharts/${flowchartId}/versions`)
      .then(r => r.json())
      .then(data => { setVersions(data); setLoading(false) })
  }, [flowchartId])

  async function loadPreview(versionNumber: number) {
    setFetching(true); setSelected(versionNumber)
    const r = await fetch(`/api/flowcharts/${flowchartId}/versions?v=${versionNumber}`)
    const d = await r.json()
    setPreview(d.code)
    setFetching(false)
  }

  function handleRestore() {
    if (preview !== null) { onRestore(preview); onClose() }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-72 border-l border-border bg-background shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-sm">Version History</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>

      {loading ? (
        <p className="p-4 text-sm text-muted-foreground">Loading…</p>
      ) : !versions.length ? (
        <p className="p-4 text-sm text-muted-foreground">No versions yet. Save to create one.</p>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {versions.map(v => (
            <button
              key={v.id}
              onClick={() => loadPreview(v.version_number)}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors border-b border-border/50
                ${selected === v.version_number ? 'bg-accent' : ''}`}
            >
              <div className="font-medium">Version {v.version_number}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(v.created_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}

      {preview !== null && (
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground mb-3">
            Preview loaded. Restoring will load this code into the editor as unsaved changes — save to commit.
          </p>
          <Button className="w-full" size="sm" onClick={handleRestore} disabled={fetching}>
            Restore version {selected}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **17.2 Commit**
```bash
git add components/editor/VersionDrawer.tsx
git commit -m "feat: add version history drawer with preview and restore"
```

---

## Task 18: Command Palette (Ctrl+K)

**File:** `components/command/CommandPalette.tsx`

- [ ] **18.1 Install cmdk** (if not already in package.json from plan-1)
```bash
npm list cmdk || npm install cmdk
```

- [ ] **18.2 Write `components/command/CommandPalette.tsx`**
```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import type { editor } from 'monaco-editor'
import type { SupportedLanguage } from '@/lib/parser'

interface Props {
  flowchartId?: string
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>
  onSave: () => Promise<void>
  onSaveAs: () => Promise<void>
  onDelete?: () => Promise<void>
  onToggleShare?: () => Promise<void>
  onDownloadPng: () => void
  onVersionHistory: () => void
  onLanguageChange: (lang: SupportedLanguage) => void
  onRenameStart: () => void
}

export function CommandPalette({
  flowchartId, editorRef,
  onSave, onSaveAs, onDelete, onToggleShare,
  onDownloadPng, onVersionHistory, onLanguageChange, onRenameStart,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault(); setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function run(fn: () => void) {
    setOpen(false)
    setTimeout(fn, 50) // close animation first
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50"
      onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg bg-background border rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <Command>
          <Command.Input placeholder="Type a command…" className="w-full px-4 py-3 text-sm outline-none border-b border-border bg-transparent" />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">No results.</Command.Empty>

            <Command.Group heading="File">
              <CmdItem onSelect={() => run(() => router.push('/editor'))}>New flowchart</CmdItem>
              <CmdItem onSelect={() => run(onSave)}>Save</CmdItem>
              <CmdItem onSelect={() => run(onSaveAs)}>Save As…</CmdItem>
              <CmdItem onSelect={() => run(onRenameStart)}>Rename</CmdItem>
              {onDelete && <CmdItem onSelect={() => run(onDelete!)}>Delete flowchart</CmdItem>}
            </Command.Group>

            <Command.Group heading="Edit">
              <CmdItem onSelect={() => run(() => editorRef.current?.trigger('', 'undo', null))}>Undo</CmdItem>
              <CmdItem onSelect={() => run(() => editorRef.current?.trigger('', 'redo', null))}>Redo</CmdItem>
            </Command.Group>

            <Command.Group heading="Language">
              <CmdItem onSelect={() => run(() => onLanguageChange('javascript'))}>Language → JavaScript</CmdItem>
              <CmdItem onSelect={() => run(() => onLanguageChange('typescript'))}>Language → TypeScript</CmdItem>
              <CmdItem onSelect={() => run(() => onLanguageChange('python'))}>Language → Python</CmdItem>
            </Command.Group>

            <Command.Group heading="View">
              <CmdItem onSelect={() => run(onVersionHistory)}>View version history</CmdItem>
              <CmdItem onSelect={() => run(() => router.push('/dashboard'))}>Dashboard</CmdItem>
            </Command.Group>

            <Command.Group heading="Share & Export">
              {onToggleShare && <CmdItem onSelect={() => run(onToggleShare!)}>Share / Unshare</CmdItem>}
              <CmdItem onSelect={() => run(onDownloadPng)}>Download PNG</CmdItem>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}

function CmdItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2 px-3 py-2 rounded text-sm cursor-pointer
        aria-selected:bg-accent hover:bg-accent transition-colors"
    >
      {children}
    </Command.Item>
  )
}
```

- [ ] **18.3 Wire CommandPalette into editor page**

In `app/(protected)/editor/[id]/page.tsx`, add after EditorLayout:
```tsx
// Add to imports
import { CommandPalette } from '@/components/command/CommandPalette'

// Add state
const [renameTrigger, setRenameTrigger] = useState(0)

// Add inside return, after VersionDrawer:
<CommandPalette
  flowchartId={id}
  editorRef={editorRef}
  onSave={handleSave}
  onSaveAs={handleSaveAs}
  onDelete={handleDelete}
  onToggleShare={handleToggleShare}
  onDownloadPng={handleDownloadPng}
  onVersionHistory={() => setShowVersions(v => !v)}
  onLanguageChange={lang => setLanguage(lang)}
  onRenameStart={() => setRenameTrigger(n => n + 1)}
/>
```

In `EditorToolbar`, expose a `renameTrigger` prop and `useEffect` to auto-focus rename when it fires:
```tsx
// Add to Props:
renameTrigger?: number

// Add in component body:
useEffect(() => {
  if (renameTrigger) setEditing(true)
}, [renameTrigger])
```

- [ ] **18.4 Commit**
```bash
git add components/command/CommandPalette.tsx app/\(protected\)/editor/
git commit -m "feat: add Ctrl+K command palette"
```

---

## Task 19: Final Build + Deploy Prep

- [ ] **19.1 Full build**
```bash
npm run build
# Expected: compiled successfully, 0 errors
```

- [ ] **19.2 Run parser tests**
```bash
npm test
# Expected: all tests pass
```

- [ ] **19.3 Verify middleware** — open incognito, navigate to `/dashboard` → redirects to `/login`

- [ ] **19.4 Verify share flow**
  1. Login → create flowchart → save
  2. Click Share → `is_public` flips, `share_id` generated
  3. Open `/share/[shareId]` in incognito → read-only view loads
  4. Click Unshare → open same URL → 404

- [ ] **19.5 Deployment checklist**
```
[ ] Supabase: tables + RLS applied (docs/supabase-setup.sql)
[ ] Supabase: trigger on_auth_user_created active
[ ] Vercel: env vars set
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - SUPABASE_SERVICE_ROLE_KEY
    - UPSTASH_REDIS_REST_URL
    - UPSTASH_REDIS_REST_TOKEN
[ ] Vercel: GitHub repo connected, auto-deploy on push to main
[ ] Test auth + save + share on production URL
```

- [ ] **19.6 Final commit**
```bash
git add -A
git commit -m "feat: Code2Flow full-stack migration complete"
```

---

**All 5 plans complete.**

## Summary of Plans

| Plan | Tasks | Deliverable |
|------|-------|-------------|
| plan-1-foundation | 1-3 | Next.js + auth working |
| plan-2-parser | 4-6 | TypeScript parsers + passing tests |
| plan-3-api | 7-11 | DB schema + all API routes |
| plan-4-editor | 12-15 | Dashboard + full editor UI |
| plan-5-features | 16-19 | Share + versions + command palette + deploy |
