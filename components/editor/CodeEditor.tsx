'use client'
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
