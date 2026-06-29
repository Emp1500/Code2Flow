'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Flowchart } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function FlowchartCard({ flowchart }: { flowchart: Flowchart }) {
  const router   = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm(`Delete "${flowchart.title}"?`)) return
    setDeleting(true)
    await fetch(`/api/flowcharts/${flowchart.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <Link href={`/editor/${flowchart.id}`}
      className="group block border rounded-lg p-4 hover:border-primary transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium truncate">{flowchart.title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary">{flowchart.language}</Badge>
          {flowchart.is_public && <Badge variant="outline">Public</Badge>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {new Date(flowchart.updated_at).toLocaleDateString()}
      </p>
      <Button
        variant="destructive" size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDelete} disabled={deleting}
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </Button>
    </Link>
  )
}
