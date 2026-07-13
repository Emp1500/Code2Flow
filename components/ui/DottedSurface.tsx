'use client'

import dynamic from 'next/dynamic'
import type { DottedSurfaceCanvasProps } from './DottedSurfaceCanvas'

const DottedSurfaceCanvas = dynamic(
  () => import('./DottedSurfaceCanvas').then(mod => mod.DottedSurfaceCanvas),
  { ssr: false }
)

export function DottedSurface(props: DottedSurfaceCanvasProps) {
  return <DottedSurfaceCanvas {...props} />
}
