'use client'

import { useEffect, useRef, useState } from 'react'
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

// The connector drop row and the card grid must share an identical 3-column
// template from sm: up, or the drops drift off the card centres.
// The gap below (gap-6) must equal the card grid's sm:gap-6. Change both together.
const CONNECTOR_COLUMNS = 'grid grid-cols-3 gap-6'
const CARD_COLUMNS = 'grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left'

// The bus spans column-1 centre to column-3 centre. With three equal columns
// and gap g: column width c = (100% - 2g)/3, so centre of column 1 sits at
// c/2 = (100% - 3rem)/6 when g = 1.5rem (gap-6).
const BUS_INSET = 'calc((100% - 3rem) / 6)'

const DROP_BASE_DELAY_MS = 440
const CARD_BASE_DELAY_MS = 560
const STAGGER_MS = 90

// Without JS the wrapper never gets data-revealed, so the pre-reveal state
// would leave every card permanently invisible. Force the resting state by
// overriding the Tailwind transform vars rather than `transform: none`, which
// would also clobber the stem's -translate-x-1/2 centring.
const NOSCRIPT_CSS =
  '[data-reveal]{opacity:1!important;--tw-scale-x:1!important;--tw-scale-y:1!important;--tw-translate-y:0px!important}'

export function FeaturesGrid() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    // One-shot entrance: honouring a live change of this preference after the
    // animation has already played has no user-visible payoff.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(root)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={rootRef}
      data-revealed={revealed ? '' : undefined}
      className="group/reveal mt-16 sm:mt-8"
    >
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: NOSCRIPT_CSS }} />
      </noscript>

      {/* Connector layer: branches from the illustration above into each card.
          Hidden below sm: where the cards stack and a 3-way branch is meaningless. */}
      <div className="relative hidden sm:block h-12" aria-hidden>
        <div
          data-reveal
          style={{ transitionDelay: '0ms' }}
          className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 origin-top scale-y-0 bg-border transition-transform duration-[220ms] ease-out group-data-[revealed]/reveal:scale-y-100 motion-reduce:transition-none"
        />
        <div
          data-reveal
          style={{ left: BUS_INSET, right: BUS_INSET, transitionDelay: '180ms' }}
          className="absolute top-6 h-px origin-center scale-x-0 bg-border transition-transform duration-[320ms] ease-out group-data-[revealed]/reveal:scale-x-100 motion-reduce:transition-none"
        />
        <div className={`absolute inset-x-0 top-6 h-6 ${CONNECTOR_COLUMNS}`}>
          {features.map((f, i) => (
            <div
              key={f.title}
              data-reveal
              style={{ transitionDelay: `${DROP_BASE_DELAY_MS + i * STAGGER_MS}ms` }}
              className="h-full w-px justify-self-center origin-top scale-y-0 bg-border transition-transform duration-200 ease-out group-data-[revealed]/reveal:scale-y-100 motion-reduce:transition-none"
            />
          ))}
        </div>
      </div>

      <div className={CARD_COLUMNS}>
        {features.map((f, i) => (
          // Outer element owns the entrance (opacity + translate + delay).
          <div
            key={f.title}
            data-reveal
            style={{ transitionDelay: `${CARD_BASE_DELAY_MS + i * STAGGER_MS}ms` }}
            className="translate-y-3 opacity-0 transition-[opacity,transform] duration-[420ms] ease-out group-data-[revealed]/reveal:translate-y-0 group-data-[revealed]/reveal:opacity-100 motion-reduce:transition-none"
          >
            {/* Inner element owns hover. Kept separate so the entrance delay
                never lags the hover response and the two never fight over
                --tw-translate-y. */}
            <div className="group/card h-full p-6 bg-card/70 hover:bg-card ring-1 ring-border/60 hover:ring-primary/40 hover:-translate-y-0.5 rounded-lg transition-[background-color,box-shadow,transform] duration-200">
              <div className="inline-flex items-center justify-center size-9 rounded-md bg-primary/10 group-hover/card:bg-primary/20 text-primary mb-4 transition-colors duration-200">
                <f.icon className="size-4" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
