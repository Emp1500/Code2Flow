'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { editor } from 'monaco-editor'
import type { SupportedLanguage } from '@/lib/parser'
import {
  ChevronLeft, Plus, Save as SaveIcon, SaveAll,
  Undo2, Redo2, Clock, Link as LinkIcon, Unlink,
  Copy, Download, Trash2,
} from 'lucide-react'
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
  renameTrigger?: number
}

function Divider() {
  return <div className="w-px h-5 bg-border shrink-0" />
}

export function EditorToolbar({
  flowchartId, title, language, isPublic, shareId, hasUnsavedChanges,
  editorRef,
  onSave, onSaveAs, onRename, onDelete, onToggleShare, onDownloadPng,
  onLanguageChange, onVersionHistory, renameTrigger,
}: Props) {
  const router  = useRouter()
  const [editing,  setEditing]  = useState(false)
  const [titleVal, setTitleVal] = useState(title)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (renameTrigger) setEditing(true)
  }, [renameTrigger])

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
    <header className="h-12 border-b border-border bg-background flex items-center px-3 gap-1.5 shrink-0">
      {/* Group: Nav */}
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ChevronLeft className="size-3.5" />Dashboard
        </Button>
      </Link>

      <Divider />

      {/* Group: File */}
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleNew}>
        <Plus className="size-3.5" />New
      </Button>
      <Button
        variant={hasUnsavedChanges ? 'secondary' : 'ghost'}
        size="sm"
        className="gap-1.5"
        onClick={handleSave}
        disabled={saving}
      >
        <SaveIcon className="size-3.5" />
        {saving ? 'Saving…' : hasUnsavedChanges ? '• Save' : 'Save'}
      </Button>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onSaveAs}>
        <SaveAll className="size-3.5" />Save As
      </Button>

      <Divider />

      {/* Group: Title */}
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
          className="text-sm font-medium px-2 py-1 rounded hover:bg-accent hover:border-b hover:border-dashed hover:border-muted-foreground transition-colors duration-150 max-w-48 truncate cursor-pointer"
          onClick={() => setEditing(true)}
          title="Click to rename"
        >
          {title}
        </button>
      )}

      <div className="flex-1" />

      {/* Group: Edit */}
      <Button variant="ghost" size="sm" className="gap-1.5"
        onClick={() => editorRef.current?.trigger('', 'undo', null)}>
        <Undo2 className="size-3.5" />Undo
      </Button>
      <Button variant="ghost" size="sm" className="gap-1.5"
        onClick={() => editorRef.current?.trigger('', 'redo', null)}>
        <Redo2 className="size-3.5" />Redo
      </Button>

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

      <Divider />

      {/* Group: View / Share */}
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onVersionHistory}>
        <Clock className="size-3.5" />History
      </Button>

      {flowchartId && (
        <Button
          variant="ghost" size="sm" className="gap-1.5"
          onClick={async () => { await onToggleShare(); if (!isPublic) handleShareCopy() }}
        >
          {isPublic
            ? <><Unlink className="size-3.5" />Unshare</>
            : <><LinkIcon className="size-3.5" />Share</>}
        </Button>
      )}

      {isPublic && shareId && (
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleShareCopy}>
          <Copy className="size-3.5" />Copy link
        </Button>
      )}

      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onDownloadPng}>
        <Download className="size-3.5" />PNG
      </Button>

      {flowchartId && (
        <>
          <Divider />
          <Button
            variant="ghost" size="sm"
            className="gap-1.5 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5" />Delete
          </Button>
        </>
      )}
    </header>
  )
}
