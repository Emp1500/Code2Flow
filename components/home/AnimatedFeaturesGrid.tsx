'use client'

import type { LucideIcon } from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  title: string
  desc: string
}

interface Props {
  features: Feature[]
}

export function AnimatedFeaturesGrid({ features }: Props) {
  return (
    <div className="mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left">
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
