'use client'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'

interface Props {
  left:  React.ReactNode
  right: React.ReactNode
}

export function EditorLayout({ left, right }: Props) {
  return (
    <PanelGroup orientation="horizontal" className="h-full">
      <Panel defaultSize={50} minSize={20}>
        {left}
      </Panel>
      <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />
      <Panel defaultSize={50} minSize={20}>
        {right}
      </Panel>
    </PanelGroup>
  )
}
