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
  const { editorRef } = editor

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
          left={<CodeEditor value={editor.code} language={editor.language} onChange={editor.setCode} onEditorMount={e => { editorRef.current = e }} />}
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
