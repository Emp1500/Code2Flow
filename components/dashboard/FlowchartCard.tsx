'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Flowchart } from '@/types'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal } from 'lucide-react'

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const langAccent: Record<string, string> = {
  javascript: 'border-t-amber-500',
  typescript: 'border-t-blue-500',
  python:     'border-t-green-500',
}

const langBadge: Record<string, string> = {
  javascript: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  typescript: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  python:     'bg-green-500/10 text-green-400 border-green-500/30',
}

export function FlowchartCard({ flowchart }: { flowchart: Flowchart }) {
  const router = useRouter()
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
    await fetch(`/api/flowcharts/${flowchart.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const accentClass = langAccent[flowchart.language] ?? ''
  const badgeClass  = langBadge[flowchart.language]  ?? ''

  return (
    <Link
      href={`/editor/${flowchart.id}`}
      className={`group block border border-t-2 ${accentClass} border-border rounded-lg bg-card shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-150`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-medium truncate">{flowchart.title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className={badgeClass}>{flowchart.language}</Badge>
            {flowchart.is_public && <Badge variant="outline">Public</Badge>}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={e => { e.preventDefault(); setMenuOpen(o => !o) }}
                className="p-1 rounded hover:bg-accent transition-colors duration-150 cursor-pointer"
                aria-label="More options"
              >
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </button>
              {menuOpen && (
                <div className="absolute top-8 right-0 z-10 w-32 bg-popover border border-border rounded-md shadow-lg py-1">
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); router.push(`/editor/${flowchart.id}`) }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors duration-150 cursor-pointer"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{timeAgo(flowchart.updated_at)}</p>
      </div>
    </Link>
  )
}
