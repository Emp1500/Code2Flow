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
