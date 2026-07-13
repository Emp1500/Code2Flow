'use client'
import dynamic from 'next/dynamic'
import { loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import type { SupportedLanguage } from '@/lib/parser'

// Self-host Monaco assets (see scripts/copy-monaco-assets.js) instead of the
// @monaco-editor/react default of fetching from cdn.jsdelivr.net, which the
// app's CSP (script-src 'self') blocks.
loader.config({ paths: { vs: '/monaco/min/vs' } })

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading editor…</div>,
})

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
