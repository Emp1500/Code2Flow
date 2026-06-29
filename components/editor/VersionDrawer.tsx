'use client'

interface Props {
  flowchartId: string
  onClose: () => void
  onRestore: (code: string) => void
}

// Stub — full implementation in Plan 5
export function VersionDrawer({ onClose }: Props) {
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-background border-l border-border shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold">Version History</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Coming soon
      </div>
    </div>
  )
}
