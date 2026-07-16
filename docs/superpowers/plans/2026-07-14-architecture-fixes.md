# Architecture Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 8 architecture gaps found in the 2026-07-14 audit (silent mutation failures, duplicated editor pages, missing ownership checks on mutation routes, zero mutation-route test coverage, no shared API client, unbounded list queries, save/pruning coupling, and dead schema/code) without changing any user-facing feature.

**Architecture:** Introduce one shared client-side data-access layer (`lib/api-client.ts`) and one shared toast UI (`components/ui/toast.tsx`, Base UI primitive) that every mutation site (editor pages, `FlowchartCard`, `VersionDrawer`) is rewired through. Harden the API route layer with explicit per-request ownership checks (defense-in-depth alongside existing RLS) and decouple non-critical cleanup (version pruning) from the critical write path. Cap unbounded list queries. Remove dead code/fields.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (`@supabase/ssr`), Zod, `@base-ui/react` (Toast, Button, Dialog primitives already in use), Jest + ts-jest (existing `testEnvironment: 'node'`, no DOM testing library present — do not add one).

## Global Constraints

- Node's built-in `fetch`/`Response`/`Request` globals are available in the Jest `node` test environment (confirmed: Node 18+, no polyfill needed).
- No jsdom/testing-library exists in this repo — do not add component-rendering tests. UI-only changes (toast wiring, hook extraction) are verified manually via `npm run dev` in a browser, matching the existing convention that only pure functions and API routes have automated tests.
- Every new/changed API route behavior must have a Jest test using the existing mock-Supabase-client pattern (see `__tests__/flowcharts-get-route.test.ts`).
- Do not change any existing passing test's behavior or the `GET /api/flowcharts/[id]` test file.
- Match existing code style: no semicolons, `const`/arrow functions, 2-space indent, existing import grouping.
- Run `npm run lint` and `npm test` before each commit in this plan.

---

## Task 1: Shared typed API client

**Files:**
- Create: `lib/api-client.ts`
- Test: `__tests__/api-client.test.ts`

**Interfaces:**
- Produces: `ApiError` (class, `.message: string`, `.status: number`), and functions `fetchFlowchart(id: string)`, `createFlowchart(input: { title: string; code: string; language: Language })`, `updateFlowchart(id: string, input: { code?: string; title?: string; language?: Language })`, `renameFlowchart(id: string, title: string)`, `deleteFlowchart(id: string)`, `toggleShare(id: string)`, `fetchVersions(flowchartId: string)`, `fetchVersion(flowchartId: string, versionNumber: number)` — all return `Promise<T>` and reject with `ApiError` on non-2xx.
- Consumes: `Flowchart`, `FlowchartVersion`, `Language` types from `@/types` (already defined in `types/index.ts`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/api-client.test.ts`:

```ts
import { fetchFlowchart, ApiError } from '@/lib/api-client'

describe('api-client error handling', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('throws an ApiError with the server message when the response is not ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 })
    )

    await expect(fetchFlowchart('fc-1')).rejects.toMatchObject({
      message: 'Rate limit exceeded',
      status: 429,
    })
  })

  it('throws a fallback ApiError when the error response has no JSON body', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('not json', { status: 500 }))

    await expect(fetchFlowchart('fc-1')).rejects.toBeInstanceOf(ApiError)
    await expect(fetchFlowchart('fc-1')).rejects.toMatchObject({ status: 500 })
  })

  it('resolves with the parsed JSON when the response is ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'fc-1', code: 'x' }), { status: 200 })
    )

    await expect(fetchFlowchart('fc-1')).resolves.toMatchObject({ id: 'fc-1', code: 'x' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api-client`
Expected: FAIL with `Cannot find module '@/lib/api-client'`

- [ ] **Step 3: Write the implementation**

Create `lib/api-client.ts`:

```ts
import type { Flowchart, FlowchartVersion, Language } from '@/types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const jsonHeaders = { 'Content-Type': 'application/json' }

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : `Request failed with status ${res.status}`
    throw new ApiError(message, res.status)
  }
  return res.json() as Promise<T>
}

export function fetchFlowchart(id: string) {
  return apiFetch<Flowchart & { code: string; version_number: number }>(`/api/flowcharts/${id}`)
}

export function createFlowchart(input: { title: string; code: string; language: Language }) {
  return apiFetch<Flowchart>('/api/flowcharts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function updateFlowchart(id: string, input: { code?: string; title?: string; language?: Language }) {
  return apiFetch<Flowchart>(`/api/flowcharts/${id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function renameFlowchart(id: string, title: string) {
  return apiFetch<Flowchart>(`/api/flowcharts/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ title }),
  })
}

export function deleteFlowchart(id: string) {
  return apiFetch<{ success: true }>(`/api/flowcharts/${id}`, { method: 'DELETE' })
}

export function toggleShare(id: string) {
  return apiFetch<{ is_public: boolean; share_id: string | null }>(`/api/flowcharts/${id}/share`, { method: 'POST' })
}

export function fetchVersions(flowchartId: string) {
  return apiFetch<Pick<FlowchartVersion, 'id' | 'version_number' | 'created_at'>[]>(
    `/api/flowcharts/${flowchartId}/versions`
  )
}

export function fetchVersion(flowchartId: string, versionNumber: number) {
  return apiFetch<Pick<FlowchartVersion, 'id' | 'code' | 'version_number' | 'created_at'>>(
    `/api/flowcharts/${flowchartId}/versions?v=${versionNumber}`
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api-client`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/api-client.ts __tests__/api-client.test.ts
git commit -m "feat: add shared typed API client for flowchart endpoints"
```

---

## Task 2: Toast notification system

**Files:**
- Create: `components/ui/toast.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `ToastProvider` (wraps subtree, must be mounted once near the app root), `Toaster` (renders the portal/viewport, must be mounted *inside* `ToastProvider`), `useToastManager()` (re-exported hook; call `.add({ title, description })` from any client component inside `ToastProvider` to show a toast).
- Consumes: `@base-ui/react/toast` (already a transitive dependency of `@base-ui/react`, confirmed present at `node_modules/@base-ui/react/toast`), `cn` from `@/lib/utils`, `Button` from `@/components/ui/button`.

- [ ] **Step 1: Create the toast primitive wrapper**

Create `components/ui/toast.tsx` (same wrapping convention as `components/ui/dialog.tsx`):

```tsx
"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed right-4 bottom-4 z-50 mx-auto flex w-[calc(100vw-2rem)] flex-col gap-2 sm:w-[22.5rem]",
        className
      )}
      {...props}
    />
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map(toast => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      className="relative w-full rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0"
    >
      <ToastPrimitive.Content className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ToastPrimitive.Title className="font-medium" />
          <ToastPrimitive.Description className="text-muted-foreground" />
        </div>
        <ToastPrimitive.Close render={<Button variant="ghost" size="icon-sm" />}>
          <XIcon />
        </ToastPrimitive.Close>
      </ToastPrimitive.Content>
    </ToastPrimitive.Root>
  ))
}

function Toaster() {
  return (
    <ToastPrimitive.Portal data-slot="toast-portal">
      <ToastViewport>
        <ToastList />
      </ToastViewport>
    </ToastPrimitive.Portal>
  )
}

const useToastManager = ToastPrimitive.useToastManager

export { ToastProvider, Toaster, useToastManager }
```

- [ ] **Step 2: Mount the provider at the app root**

Modify `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter, Fira_Code } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ToastProvider, Toaster } from '@/components/ui/toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const firaCode = Fira_Code({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Code2Flow',
  description: 'Visualize code as flowcharts',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${firaCode.variable}`}>
      <body className="font-sans">
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open any page, open the browser console and run (as a smoke test) — temporarily add a test button, or skip to Task 3 where real toasts fire on an actual save error. Confirm at minimum: `npm run build` succeeds (catches any type errors from the Base UI `Toast` API surface).

Run: `npm run build`
Expected: build succeeds with no new type errors.

- [ ] **Step 4: Commit**

```bash
git add components/ui/toast.tsx app/layout.tsx
git commit -m "feat: add toast notification system (Base UI Toast primitive)"
```

---

## Task 3: Unify editor pages and wire error toasts through every mutation site

**Files:**
- Create: `components/editor/useFlowchartEditor.ts`
- Modify: `app/(protected)/editor/page.tsx`
- Modify: `app/(protected)/editor/[id]/page.tsx`
- Modify: `components/dashboard/FlowchartCard.tsx`
- Modify: `components/editor/VersionDrawer.tsx`

**Interfaces:**
- Consumes: `lib/api-client.ts` (Task 1), `components/ui/toast.tsx`'s `useToastManager` (Task 2), `codeToMermaid`/`SupportedLanguage` from `@/lib/parser`.
- Produces: `useFlowchartEditor(initialId?: string)` returning `{ id, editorRef, panelRef, loaded, title, language, code, mermaidCode, isPublic, shareId, hasUnsavedChanges, showVersions, renameTrigger, setCode, setSavedCode, setShowVersions, setRenameTrigger, handleSave, handleSaveAs, handleRename, handleDelete, handleToggleShare, handleDownloadPng, handleLanguageChange }`. Both editor pages and nothing else consume this hook.

- [ ] **Step 1: Create the shared editor hook**

Create `components/editor/useFlowchartEditor.ts`:

```ts
'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { editor } from 'monaco-editor'
import { toPng } from 'html-to-image'
import { codeToMermaid } from '@/lib/parser'
import type { SupportedLanguage } from '@/lib/parser'
import * as api from '@/lib/api-client'
import { ApiError } from '@/lib/api-client'
import { useToastManager } from '@/components/ui/toast'

const DEFAULT_CODE: Record<SupportedLanguage, string> = {
  javascript: `function greet(name) {\n  if (name) {\n    return "Hello, " + name;\n  } else {\n    return "Hello, World!";\n  }\n}`,
  typescript: `function greet(name: string): string {\n  if (name) {\n    return \`Hello, \${name}\`;\n  } else {\n    return "Hello, World!";\n  }\n}`,
  python:     `def greet(name):\n    if name:\n        return f"Hello, {name}"\n    else:\n        return "Hello, World!"`,
}

function errorDescription(err: unknown) {
  return err instanceof ApiError ? err.message : 'Please try again.'
}

export function useFlowchartEditor(initialId?: string) {
  const router    = useRouter()
  const toast     = useToastManager()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const panelRef  = useRef<HTMLDivElement>(null)

  const [id, setId]                     = useState(initialId)
  const [loaded, setLoaded]             = useState(!initialId)
  const [title, setTitle]               = useState('Untitled')
  const [language, setLanguage]         = useState<SupportedLanguage>('javascript')
  const [code, setCode]                 = useState(initialId ? '' : DEFAULT_CODE.javascript)
  const [savedCode, setSavedCode]       = useState('')
  const [isPublic, setIsPublic]         = useState(false)
  const [shareId, setShareId]           = useState<string | null>(null)
  const [mermaidCode, setMermaidCode]   = useState('')
  const [showVersions, setShowVersions] = useState(false)
  const [renameTrigger, setRenameTrigger] = useState(0)

  useEffect(() => {
    if (!initialId) return
    api.fetchFlowchart(initialId)
      .then(fc => {
        setTitle(fc.title); setLanguage(fc.language); setCode(fc.code ?? '')
        setSavedCode(fc.code ?? ''); setIsPublic(fc.is_public); setShareId(fc.share_id)
        setLoaded(true)
      })
      .catch(err => {
        setLoaded(true)
        toast.add({ title: 'Failed to load flowchart', description: errorDescription(err) })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId])

  useEffect(() => {
    if (!loaded) return
    try { setMermaidCode(codeToMermaid(code, language)) } catch {}
  }, [code, language, loaded])

  const hasUnsavedChanges = code !== savedCode

  const handleSave = useCallback(async () => {
    try {
      if (!id) {
        const fc = await api.createFlowchart({ title, code, language })
        setId(fc.id)
        setSavedCode(code)
        router.replace(`/editor/${fc.id}`)
      } else {
        await api.updateFlowchart(id, { code, language })
        setSavedCode(code)
      }
    } catch (err) {
      toast.add({ title: 'Save failed', description: errorDescription(err) })
    }
  }, [id, title, code, language, router, toast])

  const handleSaveAs = useCallback(async () => {
    const newTitle = prompt('Title for new flowchart:', title + ' (copy)')
    if (!newTitle) return
    try {
      const fc = await api.createFlowchart({ title: newTitle, code, language })
      router.push(`/editor/${fc.id}`)
    } catch (err) {
      toast.add({ title: 'Save As failed', description: errorDescription(err) })
    }
  }, [title, code, language, router, toast])

  const handleRename = useCallback(async (newTitle: string) => {
    const previous = title
    setTitle(newTitle)
    if (!id) return
    try {
      await api.renameFlowchart(id, newTitle)
      document.title = `${newTitle} — Code2Flow`
    } catch (err) {
      setTitle(previous)
      toast.add({ title: 'Rename failed', description: errorDescription(err) })
    }
  }, [id, title, toast])

  const handleDelete = useCallback(async () => {
    if (!id) { router.push('/dashboard'); return }
    try {
      await api.deleteFlowchart(id)
      router.push('/dashboard')
    } catch (err) {
      toast.add({ title: 'Delete failed', description: errorDescription(err) })
    }
  }, [id, router, toast])

  const handleToggleShare = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.toggleShare(id)
      setIsPublic(data.is_public); setShareId(data.share_id)
    } catch (err) {
      toast.add({ title: 'Share update failed', description: errorDescription(err) })
    }
  }, [id, toast])

  function handleDownloadPng() {
    if (!panelRef.current) return
    toPng(panelRef.current).then(url => {
      const a = document.createElement('a'); a.href = url; a.download = `${title}-flowchart.png`; a.click()
    })
  }

  function handleLanguageChange(lang: SupportedLanguage) {
    setLanguage(lang)
    if (!id) setCode(DEFAULT_CODE[lang])
  }

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

  return {
    id, editorRef, panelRef, loaded, title, language, code, mermaidCode,
    isPublic, shareId, hasUnsavedChanges, showVersions, renameTrigger,
    setCode, setSavedCode, setShowVersions, setRenameTrigger,
    handleSave, handleSaveAs, handleRename, handleDelete, handleToggleShare,
    handleDownloadPng, handleLanguageChange,
  }
}
```

- [ ] **Step 2: Rewrite the existing-flowchart editor page to use the hook**

Replace the full contents of `app/(protected)/editor/[id]/page.tsx`:

```tsx
'use client'
import { useParams } from 'next/navigation'
import { CodeEditor }     from '@/components/editor/CodeEditor'
import { FlowchartPanel } from '@/components/editor/FlowchartPanel'
import { EditorLayout }   from '@/components/editor/EditorLayout'
import { EditorToolbar }  from '@/components/editor/EditorToolbar'
import { VersionDrawer }  from '@/components/editor/VersionDrawer'
import { CommandPalette } from '@/components/command/CommandPalette'
import { useFlowchartEditor } from '@/components/editor/useFlowchartEditor'

export default function EditFlowchartPage() {
  const { id } = useParams<{ id: string }>()
  const editor = useFlowchartEditor(id)

  if (!editor.loaded) return <div className="h-screen flex items-center justify-center text-muted-foreground">Loading…</div>

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        flowchartId={editor.id} title={editor.title} language={editor.language}
        isPublic={editor.isPublic} shareId={editor.shareId}
        hasUnsavedChanges={editor.hasUnsavedChanges} editorRef={editor.editorRef} code={editor.code}
        onSave={editor.handleSave} onSaveAs={editor.handleSaveAs} onRename={editor.handleRename}
        onDelete={editor.handleDelete} onToggleShare={editor.handleToggleShare}
        onDownloadPng={editor.handleDownloadPng}
        onLanguageChange={editor.handleLanguageChange}
        onVersionHistory={() => editor.setShowVersions(v => !v)}
        renameTrigger={editor.renameTrigger}
      />
      <div className="flex-1 overflow-hidden">
        <EditorLayout
          left={<CodeEditor value={editor.code} language={editor.language} onChange={editor.setCode} onEditorMount={e => { editor.editorRef.current = e }} />}
          right={<FlowchartPanel mermaidCode={editor.mermaidCode} panelRef={editor.panelRef} />}
        />
      </div>
      {editor.showVersions && (
        <VersionDrawer flowchartId={editor.id ?? ''} onClose={() => editor.setShowVersions(false)}
          onRestore={c => { editor.setCode(c); editor.setSavedCode(c) }} />
      )}
      <CommandPalette
        flowchartId={editor.id}
        editorRef={editor.editorRef}
        onSave={editor.handleSave}
        onSaveAs={editor.handleSaveAs}
        onDelete={editor.handleDelete}
        onToggleShare={editor.handleToggleShare}
        onDownloadPng={editor.handleDownloadPng}
        onVersionHistory={() => editor.setShowVersions(v => !v)}
        onLanguageChange={editor.handleLanguageChange}
        onRenameStart={() => editor.setRenameTrigger(n => n + 1)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Rewrite the new-flowchart editor page to use the same hook**

Replace the full contents of `app/(protected)/editor/page.tsx`:

```tsx
'use client'
import { CodeEditor }     from '@/components/editor/CodeEditor'
import { FlowchartPanel } from '@/components/editor/FlowchartPanel'
import { EditorLayout }   from '@/components/editor/EditorLayout'
import { EditorToolbar }  from '@/components/editor/EditorToolbar'
import { VersionDrawer }  from '@/components/editor/VersionDrawer'
import { CommandPalette } from '@/components/command/CommandPalette'
import { useFlowchartEditor } from '@/components/editor/useFlowchartEditor'

export default function NewEditorPage() {
  const editor = useFlowchartEditor()

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        flowchartId={editor.id} title={editor.title} language={editor.language}
        isPublic={editor.isPublic} shareId={editor.shareId}
        hasUnsavedChanges={editor.hasUnsavedChanges} editorRef={editor.editorRef} code={editor.code}
        onSave={editor.handleSave} onSaveAs={editor.handleSaveAs} onRename={editor.handleRename}
        onDelete={editor.handleDelete} onToggleShare={editor.handleToggleShare}
        onDownloadPng={editor.handleDownloadPng}
        onLanguageChange={editor.handleLanguageChange}
        onVersionHistory={() => editor.setShowVersions(v => !v)}
        renameTrigger={editor.renameTrigger}
      />
      <div className="flex-1 overflow-hidden">
        <EditorLayout
          left={<CodeEditor value={editor.code} language={editor.language} onChange={editor.setCode} onEditorMount={e => { editor.editorRef.current = e }} />}
          right={<FlowchartPanel mermaidCode={editor.mermaidCode} panelRef={editor.panelRef} />}
        />
      </div>
      {editor.showVersions && (
        <VersionDrawer flowchartId={editor.id ?? ''} onClose={() => editor.setShowVersions(false)}
          onRestore={c => { editor.setCode(c); editor.setSavedCode(c) }} />
      )}
      <CommandPalette
        flowchartId={editor.id}
        editorRef={editor.editorRef}
        onSave={editor.handleSave}
        onSaveAs={editor.handleSaveAs}
        onDelete={editor.handleDelete}
        onToggleShare={editor.handleToggleShare}
        onDownloadPng={editor.handleDownloadPng}
        onVersionHistory={() => editor.setShowVersions(v => !v)}
        onLanguageChange={editor.handleLanguageChange}
        onRenameStart={() => editor.setRenameTrigger(n => n + 1)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Wire error toasts into `VersionDrawer`'s two hand-rolled fetches**

Modify `components/editor/VersionDrawer.tsx` — replace the `fetch` calls with the api-client and surface failures:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { FlowchartVersion } from '@/types'
import { fetchVersions, fetchVersion, ApiError } from '@/lib/api-client'
import { useToastManager } from '@/components/ui/toast'

interface Props {
  flowchartId: string
  onClose: () => void
  onRestore: (code: string) => void
}

export function VersionDrawer({ flowchartId, onClose, onRestore }: Props) {
  const toast = useToastManager()
  const [versions, setVersions] = useState<Omit<FlowchartVersion, 'code'>[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [preview,  setPreview]  = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!flowchartId) { setLoading(false); return }
    fetchVersions(flowchartId)
      .then(data => { setVersions(data); setLoading(false) })
      .catch(err => {
        setLoading(false)
        toast.add({
          title: 'Failed to load version history',
          description: err instanceof ApiError ? err.message : 'Please try again.',
        })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowchartId])

  async function loadPreview(versionNumber: number) {
    setFetching(true); setSelected(versionNumber)
    try {
      const d = await fetchVersion(flowchartId, versionNumber)
      setPreview(d.code)
    } catch (err) {
      toast.add({
        title: 'Failed to load version',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    } finally {
      setFetching(false)
    }
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
          <Separator className="mb-3" />
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

- [ ] **Step 5: Wire the dashboard card's delete into the api-client + toast**

Modify `components/dashboard/FlowchartCard.tsx` — replace the imports and `handleDelete`:

```tsx
'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Flowchart } from '@/types'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal } from 'lucide-react'
import { deleteFlowchart, ApiError } from '@/lib/api-client'
import { useToastManager } from '@/components/ui/toast'
```

(keep `timeAgo`, `langAccent`, `langBadge` unchanged), then replace `handleDelete`:

```tsx
export function FlowchartCard({ flowchart }: { flowchart: Flowchart }) {
  const router = useRouter()
  const toast = useToastManager()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    setMenuOpen(false)
    if (!confirm(`Delete "${flowchart.title}"?`)) return
    setDeleting(true)
    try {
      await deleteFlowchart(flowchart.id)
      router.refresh()
    } catch (err) {
      setDeleting(false)
      toast.add({
        title: 'Delete failed',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    }
  }
```

(the JSX return block is unchanged — only the imports, the `toast` hook call, and the body of `handleDelete` change).

- [ ] **Step 6: Verify manually in the browser**

Run: `npm run dev`, then in a browser:
1. Go to `/editor` (new flowchart) — confirm Ctrl+K opens the command palette and Ctrl+S saves (this previously didn't work on this route — confirms the drift bug is fixed).
2. Save a flowchart, then go to `/dashboard`, delete it — confirm success still works.
3. Trigger a save failure by opening DevTools → Network → set to "Offline", then press Ctrl+S in the editor — confirm a toast reading "Save failed" appears (previously this failed silently).
4. Re-enable network, confirm normal save/delete/rename/share still work end to end.

Expected: all four checks pass with no console errors beyond the intentionally-triggered offline failure.

- [ ] **Step 7: Run lint, type-check, and existing tests**

Run: `npm run lint && npm test`
Expected: no new lint errors, all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add components/editor/useFlowchartEditor.ts app/'(protected)'/editor/page.tsx "app/(protected)/editor/[id]/page.tsx" components/editor/VersionDrawer.tsx components/dashboard/FlowchartCard.tsx
git commit -m "refactor: unify editor pages into shared hook, surface mutation failures via toast"
```

---

## Task 4: Harden mutation-route ownership, decouple version pruning, remove dead service client

**Files:**
- Modify: `app/api/flowcharts/[id]/route.ts`
- Modify: `app/api/flowcharts/[id]/share/route.ts`
- Modify: `lib/supabase/server.ts`
- Create: `__tests__/helpers/supabase-query-mock.ts`
- Create: `__tests__/flowcharts-put-route.test.ts`
- Create: `__tests__/flowcharts-patch-route.test.ts`
- Create: `__tests__/flowcharts-delete-route.test.ts`
- Create: `__tests__/flowcharts-share-route.test.ts`

**Interfaces:**
- Produces: `createQueryMock()` in the test helper — returns a chainable **and thenable** mock Supabase query builder: every chain method (`select`, `eq`, `order`, `limit`, `in`, `update`, `insert`, `delete`, `single`) returns the same mock object, and `.queueResult({ data, error })` queues a value that the *next* `await` on the chain resolves to (FIFO), regardless of which method the chain happened to end on. This is necessary because the real PUT handler terminates different query chains on different methods (`.single()`, `.insert()`, `.order()`, `.in()`), unlike the existing `GET` test which only ever terminates on `.single()`.
- Consumes: nothing new — existing `checkRateLimit`/`saveLimit`/`shareLimit` from `@/lib/rate-limit`, `generateShareId` from `@/lib/share`.

- [ ] **Step 1: Write the test helper (no test framework needed to "fail" first — this is shared infrastructure, not a behavior under test)**

Create `__tests__/helpers/supabase-query-mock.ts`:

```ts
type QueryResult = { data: any; error: any }

export function createQueryMock() {
  const queue: QueryResult[] = []
  const mock: any = {
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    order: jest.fn(() => mock),
    limit: jest.fn(() => mock),
    in: jest.fn(() => mock),
    update: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    delete: jest.fn(() => mock),
    single: jest.fn(() => mock),
    queueResult(result: QueryResult) {
      queue.push(result)
      return mock
    },
    then(resolve: (value: QueryResult) => void) {
      resolve(queue.shift() ?? { data: null, error: null })
    },
  }
  return mock
}
```

- [ ] **Step 2: Write the failing tests for PUT**

Create `__tests__/flowcharts-put-route.test.ts`:

```ts
import { PUT } from '@/app/api/flowcharts/[id]/route'
import { createQueryMock } from './helpers/supabase-query-mock'

jest.mock('@/lib/rate-limit', () => ({
  saveLimit: {},
  checkRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
}))

let flowchartsQuery: ReturnType<typeof createQueryMock>
let versionsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: (table: string) => (table === 'flowcharts' ? flowchartsQuery : versionsQuery),
  })),
}))

function putRequest(body: object) {
  return new Request('http://localhost/api/flowcharts/fc-1', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('PUT /api/flowcharts/[id]', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
    versionsQuery = createQueryMock()
  })

  it('returns 404 and skips all writes when the caller does not own the flowchart', async () => {
    flowchartsQuery.queueResult({ data: null, error: { code: 'PGRST116' } })

    const response = await PUT(putRequest({ code: 'x' }), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(response.status).toBe(404)
    expect(versionsQuery.insert).not.toHaveBeenCalled()
  })

  it('still returns 200 with the updated flowchart when pruning old versions fails', async () => {
    flowchartsQuery
      .queueResult({ data: { id: 'fc-1' }, error: null })                // ownership check
      .queueResult({ data: { id: 'fc-1', title: 'T' }, error: null })    // final reload

    versionsQuery
      .queueResult({ data: { version_number: 3 }, error: null })         // latest version lookup
      .queueResult({ data: null, error: null })                          // version insert
      .queueResult({ data: null, error: { message: 'boom' } })           // prune list lookup fails

    const response = await PUT(putRequest({ code: 'new code' }), { params: Promise.resolve({ id: 'fc-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ id: 'fc-1', title: 'T' })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- flowcharts-put-route`
Expected: FAIL — first test fails because PUT currently has no ownership check (never returns 404 for a non-owned id); second test fails because a pruning-list error currently causes a 500 instead of 200.

- [ ] **Step 4: Implement the PUT handler changes**

Modify `app/api/flowcharts/[id]/route.ts` — replace the `PUT` function:

```ts
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: owned, error: ownerError } = await supabase
    .from('flowcharts').select('id').eq('id', id).eq('user_id', user.id).single()
  if (ownerError || !owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { success, retryAfter } = await checkRateLimit(saveLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const body   = await request.json()
  const parsed = UpdateFlowchartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { code, ...meta } = parsed.data

  if (Object.keys(meta).length) {
    const { error: metaError } = await supabase.from('flowcharts').update(meta).eq('id', id)
    if (metaError) return NextResponse.json({ error: 'Failed to update flowchart' }, { status: 500 })
  }

  if (code !== undefined) {
    const latestRes = await supabase
      .from('flowchart_versions')
      .select('version_number')
      .eq('flowchart_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()
    const latest = latestRes.data as { version_number: number } | null

    const nextVersion = (latest?.version_number ?? 0) + 1

    const { error: versionError } = await supabase.from('flowchart_versions').insert({
      flowchart_id: id, code, version_number: nextVersion,
    })
    if (versionError) return NextResponse.json({ error: 'Failed to save flowchart contents' }, { status: 500 })

    const { data: all, error: listError } = await supabase
      .from('flowchart_versions')
      .select('id, version_number')
      .eq('flowchart_id', id)
      .order('version_number', { ascending: true })

    if (listError) {
      console.error('Failed to list versions for pruning (save already succeeded):', listError)
    } else if (all && all.length > 50) {
      const toDelete = all.slice(0, all.length - 50).map(v => v.id)
      const { error: deleteError } = await supabase.from('flowchart_versions').delete().in('id', toDelete)
      if (deleteError) console.error('Failed to prune old versions (save already succeeded):', deleteError)
    }
  }

  const { data: updated, error: reloadError } = await supabase.from('flowcharts').select('*').eq('id', id).single()
  if (reloadError) return NextResponse.json({ error: 'Failed to reload flowchart' }, { status: 500 })
  return NextResponse.json(updated)
}
```

- [ ] **Step 5: Run tests to verify PUT tests pass**

Run: `npm test -- flowcharts-put-route`
Expected: PASS (2 tests). Also run `npm test -- flowcharts-get-route` to confirm the existing GET test is untouched and still passes.

- [ ] **Step 6: Write the failing tests for PATCH and DELETE**

Create `__tests__/flowcharts-patch-route.test.ts`:

```ts
import { PATCH } from '@/app/api/flowcharts/[id]/route'
import { createQueryMock } from './helpers/supabase-query-mock'

let flowchartsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: () => flowchartsQuery,
  })),
}))

function patchRequest(body: object) {
  return new Request('http://localhost/api/flowcharts/fc-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/flowcharts/[id]', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
  })

  it('returns 404 when the caller does not own the flowchart', async () => {
    flowchartsQuery.queueResult({ data: null, error: { code: 'PGRST116' } })

    const response = await PATCH(patchRequest({ title: 'New title' }), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(response.status).toBe(404)
  })

  it('scopes the update to the authenticated user', async () => {
    flowchartsQuery.queueResult({ data: { id: 'fc-1', title: 'New title' }, error: null })

    await PATCH(patchRequest({ title: 'New title' }), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(flowchartsQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
```

Create `__tests__/flowcharts-delete-route.test.ts`:

```ts
import { DELETE } from '@/app/api/flowcharts/[id]/route'
import { createQueryMock } from './helpers/supabase-query-mock'

let flowchartsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: () => flowchartsQuery,
  })),
}))

describe('DELETE /api/flowcharts/[id]', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
  })

  it('returns 404 when the caller does not own the flowchart', async () => {
    flowchartsQuery.queueResult({ data: null, error: { code: 'PGRST116' } })

    const response = await DELETE(
      new Request('http://localhost/api/flowcharts/fc-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'fc-1' }) }
    )

    expect(response.status).toBe(404)
  })

  it('deletes and returns success when the caller owns the flowchart', async () => {
    flowchartsQuery.queueResult({ data: { id: 'fc-1' }, error: null })

    const response = await DELETE(
      new Request('http://localhost/api/flowcharts/fc-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'fc-1' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(flowchartsQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npm test -- flowcharts-patch-route flowcharts-delete-route`
Expected: FAIL — neither route currently scopes its mutation to `user_id`, and DELETE currently has no way to distinguish "not found" from "success" (it never selects the deleted row back).

- [ ] **Step 8: Implement the PATCH and DELETE handler changes**

Modify `app/api/flowcharts/[id]/route.ts` — replace `PATCH` and `DELETE`:

```ts
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = RenameSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('flowcharts').update({ title: parsed.data.title }).eq('id', id).eq('user_id', user.id).select().single()
  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error('PATCH /api/flowcharts/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to rename flowchart' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('flowcharts').delete().eq('id', id).eq('user_id', user.id).select().single()
  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error('DELETE /api/flowcharts/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to delete flowchart' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 9: Run tests to verify PATCH/DELETE tests pass**

Run: `npm test -- flowcharts-patch-route flowcharts-delete-route`
Expected: PASS (4 tests)

- [ ] **Step 10: Write the failing test for the share route**

Create `__tests__/flowcharts-share-route.test.ts`:

```ts
import { POST } from '@/app/api/flowcharts/[id]/share/route'
import { createQueryMock } from './helpers/supabase-query-mock'

jest.mock('@/lib/rate-limit', () => ({
  shareLimit: {},
  checkRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
}))
jest.mock('@/lib/share', () => ({ generateShareId: () => 'share-xyz' }))

let flowchartsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: () => flowchartsQuery,
  })),
}))

function shareRequest() {
  return new Request('http://localhost/api/flowcharts/fc-1/share', { method: 'POST' })
}

describe('POST /api/flowcharts/[id]/share', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
  })

  it('returns 404 when the caller does not own the flowchart', async () => {
    flowchartsQuery.queueResult({ data: null, error: { code: 'PGRST116' } })

    const response = await POST(shareRequest(), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(response.status).toBe(404)
  })

  it('scopes both the read and the update to the authenticated user', async () => {
    flowchartsQuery
      .queueResult({ data: { is_public: false, share_id: null }, error: null })
      .queueResult({ data: { is_public: true, share_id: 'share-xyz' }, error: null })

    await POST(shareRequest(), { params: Promise.resolve({ id: 'fc-1' }) })

    expect(flowchartsQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
```

- [ ] **Step 11: Run test to verify it fails**

Run: `npm test -- flowcharts-share-route`
Expected: FAIL — the share route currently doesn't filter by `user_id`, so `toHaveBeenCalledWith('user_id', 'user-1')` never matches.

- [ ] **Step 12: Implement the share route change**

Modify `app/api/flowcharts/[id]/share/route.ts`:

```ts
import { createClient }    from '@/lib/supabase/server'
import { generateShareId } from '@/lib/share'
import { shareLimit, checkRateLimit } from '@/lib/rate-limit'
import { NextResponse }    from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, retryAfter } = await checkRateLimit(shareLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const { data: fc, error: fetchError } = await supabase
    .from('flowcharts').select('is_public, share_id').eq('id', id).eq('user_id', user.id).single()
  if (fetchError || !fc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const toggled    = !fc.is_public
  const share_id   = toggled ? generateShareId() : fc.share_id
  const updateData = toggled ? { is_public: true, share_id } : { is_public: false }

  const { data: updated, error: updateError } = await supabase
    .from('flowcharts').update(updateData).eq('id', id).eq('user_id', user.id).select('is_public, share_id').single()

  if (updateError) return NextResponse.json({ error: 'Failed to update share settings' }, { status: 500 })

  return NextResponse.json(updated)
}
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npm test -- flowcharts-share-route`
Expected: PASS (2 tests)

- [ ] **Step 14: Remove the dead, unused service-role client**

Modify `lib/supabase/server.ts` — delete the `createServiceClient` export entirely, leaving only:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 15: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: all tests pass (existing + new), no lint errors. `grep -rn "createServiceClient" --include="*.ts" --include="*.tsx" .` (excluding `node_modules`) returns no results.

- [ ] **Step 16: Commit**

```bash
git add app/api/flowcharts/[id]/route.ts app/api/flowcharts/[id]/share/route.ts lib/supabase/server.ts __tests__/helpers/supabase-query-mock.ts __tests__/flowcharts-put-route.test.ts __tests__/flowcharts-patch-route.test.ts __tests__/flowcharts-delete-route.test.ts __tests__/flowcharts-share-route.test.ts
git commit -m "fix: enforce per-request ownership on mutation routes, decouple version pruning from save, remove dead service client"
```

---

## Task 5: Bound unbounded list queries

**Files:**
- Modify: `app/api/flowcharts/route.ts`
- Modify: `app/(protected)/dashboard/page.tsx`
- Test: `__tests__/flowcharts-list-route.test.ts`

**Interfaces:**
- No public interface changes — `GET /api/flowcharts` keeps returning a plain array; the dashboard page keeps its existing props to `FlowchartCard`. Only the query itself gains a cap.

- [ ] **Step 1: Write the failing test**

Create `__tests__/flowcharts-list-route.test.ts`:

```ts
import { GET } from '@/app/api/flowcharts/route'
import { createQueryMock } from './helpers/supabase-query-mock'

let flowchartsQuery: ReturnType<typeof createQueryMock>

jest.mock('@/lib/rate-limit', () => ({
  saveLimit: {},
  checkRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: () => flowchartsQuery,
  })),
}))

describe('GET /api/flowcharts', () => {
  beforeEach(() => {
    flowchartsQuery = createQueryMock()
  })

  it('caps the list query so a single user cannot load an unbounded number of rows', async () => {
    flowchartsQuery.queueResult({ data: [], error: null })

    await GET()

    expect(flowchartsQuery.limit).toHaveBeenCalledWith(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- flowcharts-list-route`
Expected: FAIL — `GET /api/flowcharts` currently never calls `.limit(...)`.

- [ ] **Step 3: Implement the cap in the API route**

Modify `app/api/flowcharts/route.ts` — in the `GET` function, add `.limit(100)` to the query chain:

```ts
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('flowcharts')
    .select('id, title, language, is_public, share_id, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('GET /api/flowcharts failed:', error)
    return NextResponse.json({ error: 'Failed to load flowcharts' }, { status: 500 })
  }
  return NextResponse.json(data)
}
```

(the `POST` function in this file is unchanged)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- flowcharts-list-route`
Expected: PASS

- [ ] **Step 5: Apply the same cap to the dashboard's server-side query**

Modify `app/(protected)/dashboard/page.tsx` — add `.limit(100)`:

```tsx
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } }   = await supabase.auth.getUser()
  const { data: flowcharts } = await supabase
    .from('flowcharts')
    .select('*')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })
    .limit(100)
```

(the rest of the file — the JSX render, empty state, `FlowchartCard` mapping — is unchanged)

- [ ] **Step 6: Verify manually**

Run: `npm run dev`, open `/dashboard` as the seeded demo user (`npm run seed:demo-user` if not already seeded), confirm the page still renders the existing flowcharts correctly.

- [ ] **Step 7: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: all tests pass, no lint errors.

- [ ] **Step 8: Commit**

```bash
git add app/api/flowcharts/route.ts "app/(protected)/dashboard/page.tsx" __tests__/flowcharts-list-route.test.ts
git commit -m "fix: cap unbounded flowchart list queries at 100 rows"
```

---

## Task 6: Remove unused `thumbnail_url` schema drift

**Files:**
- Modify: `types/index.ts`
- Modify: `docs/supabase-setup.sql`

**Interfaces:** none — `thumbnail_url` is confirmed unread and unwritten anywhere in `app/`, `components/`, or `lib/` (verified via `grep -rn "thumbnail_url"` before writing this plan, which only matched `types/index.ts` and `docs/supabase-setup.sql`).

- [ ] **Step 1: Remove the field from the `Flowchart` type**

Modify `types/index.ts` — remove the `thumbnail_url` line from the `Flowchart` interface:

```ts
export interface Flowchart {
  id: string
  user_id: string
  title: string
  language: Language
  is_public: boolean
  share_id: string | null
  created_at: string
  updated_at: string
}
```

(everything else in the file — `Profile`, `FlowchartVersion`, `Database`, which derives `Row`/`Insert`/`Update` from `Flowchart` automatically — is unchanged and needs no further edits)

- [ ] **Step 2: Remove the column from the setup SQL doc**

Modify `docs/supabase-setup.sql` — delete the `thumbnail_url TEXT,` line (line 17) from the `flowcharts` table definition. This only affects documentation for *new* Supabase project setups; it does not run any migration against the already-deployed production database, since that SQL file is not automatically re-applied.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds (confirms nothing else referenced the removed field).

Run: `grep -rn "thumbnail_url" --include="*.ts" --include="*.tsx" --include="*.sql" . --exclude-dir=node_modules`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts docs/supabase-setup.sql
git commit -m "chore: remove unused thumbnail_url field (dead schema/type drift)"
```

---

## Final check

After all 6 tasks are committed:

Run: `npm run lint && npm test && npm run build`
Expected: all green.

Run: `git log --oneline -6`
Expected: 6 new commits, one per task, in the order above.
