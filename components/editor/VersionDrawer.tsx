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
