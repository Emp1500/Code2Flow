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
  editorRef,
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
    setTimeout(fn, 50)
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
