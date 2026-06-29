'use client'
import { useState } from 'react'
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
  editorRef,
  onSave, onSaveAs, onRename, onDelete, onToggleShare, onDownloadPng,
  onLanguageChange, onVersionHistory,
}: Props) {
  const router  = useRouter()
  const [editing, setEditing]   = useState(false)
  const [titleVal, setTitleVal] = useState(title)
  const [saving, setSaving]     = useState(false)

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
      <Button variant="ghost" size="sm" onClick={handleNew}>New</Button>
      <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : hasUnsavedChanges ? 'Save*' : 'Save'}
      </Button>
      <Button variant="ghost" size="sm" onClick={onSaveAs}>Save As</Button>

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

      <Button variant="ghost" size="sm" onClick={() => editorRef.current?.trigger('', 'undo', null)}>Undo</Button>
      <Button variant="ghost" size="sm" onClick={() => editorRef.current?.trigger('', 'redo', null)}>Redo</Button>

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

      <Button variant="ghost" size="sm" onClick={onVersionHistory}>History</Button>

      {flowchartId && (
        <Button variant="ghost" size="sm" onClick={async () => { await onToggleShare(); if (!isPublic) handleShareCopy() }}>
          {isPublic ? 'Unshare' : 'Share'}
        </Button>
      )}
      {isPublic && shareId && (
        <Button variant="ghost" size="sm" onClick={handleShareCopy}>Copy link</Button>
      )}

      <Button variant="ghost" size="sm" onClick={onDownloadPng}>PNG</Button>

      {flowchartId && (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDelete}>Delete</Button>
      )}
    </header>
  )
}
