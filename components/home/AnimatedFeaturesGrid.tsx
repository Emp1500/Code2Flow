'use client'

import { useEffect, useRef } from 'react'
import { createLayout, stagger } from 'animejs'
import type { AutoLayout } from 'animejs'
import { Zap, Clock, Share2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  title: string
  desc: string
}

const features: Feature[] = [
  {
    icon: Zap,
    title: 'Instant preview',
    desc: 'Flowchart updates as you type with 250ms debounce.',
  },
  {
    icon: Clock,
    title: 'Version history',
    desc: 'Every save creates a version. Restore any previous state.',
  },
  {
    icon: Share2,
    title: 'Public sharing',
    desc: 'Toggle a link to share read-only views with anyone.',
  },
]

const GRID_CLASSES = 'mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left'
const LIST_CLASSES = 'mt-16 sm:mt-20 flex flex-col gap-4 text-left list-view'
const TRANSITION_DURATION_MS = 700
const STAGGER_DELAY_MS = 80
const CYCLE_DWELL_MS = 1800

export function AnimatedFeaturesGrid() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let layout: AutoLayout | null = null
    let timerId: ReturnType<typeof setTimeout> | null = null
    let observer: IntersectionObserver | null = null
    let running = false
    let visible = false
    let isAnimating = false

    function cycle() {
      if (!layout || isAnimating) return
      isAnimating = true
      layout.update(({ root }) => {
        (root as HTMLElement).className = (root as HTMLElement).classList.contains('list-view') ? GRID_CLASSES : LIST_CLASSES
      }, {
        duration: TRANSITION_DURATION_MS,
        delay: stagger(STAGGER_DELAY_MS),
        onComplete: () => {
          isAnimating = false
          if (running && visible) timerId = setTimeout(cycle, CYCLE_DWELL_MS)
        },
      })
    }

    function start() {
      if (layout || !root) return
      layout = createLayout(root)
      running = true
      observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
        if (visible) {
          if (timerId === null && !isAnimating) cycle()
        } else if (timerId !== null) {
          clearTimeout(timerId)
          timerId = null
        }
      })
      observer.observe(root)
    }

    function stop() {
      running = false
      if (timerId !== null) { clearTimeout(timerId); timerId = null }
      observer?.disconnect()
      observer = null
      layout?.revert()
      layout = null
      root!.className = GRID_CLASSES
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!motionQuery.matches) start()

    function handleMotionChange(e: MediaQueryListEvent) {
      if (e.matches) stop()
      else start()
    }
    motionQuery.addEventListener('change', handleMotionChange)

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange)
      stop()
    }
  }, [])

  return (
    <div ref={rootRef} className={GRID_CLASSES}>
      {features.map(f => (
        <div
          key={f.title}
          className="p-6 bg-card/70 hover:bg-card transition-colors duration-200 ring-1 ring-border/60 hover:ring-border rounded-lg"
        >
          <div className="inline-flex items-center justify-center size-9 rounded-md bg-primary/10 text-primary mb-4">
            <f.icon className="size-4" />
          </div>
          <h3 className="font-semibold mb-2">{f.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  )
}
