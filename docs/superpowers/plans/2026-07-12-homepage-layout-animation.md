# Homepage Features-Grid Layout Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate the homepage's 3-card features section between a grid layout and a stacked-list layout using anime.js's `createLayout` (Auto Layout), looping continuously while visible, fully disabled under `prefers-reduced-motion: reduce`.

**Architecture:** Extract the existing static features grid out of `app/page.tsx` (a server component) into a new client component, `components/home/AnimatedFeaturesGrid.tsx`. That component owns a `ref` to its root `<div>`, calls `createLayout()` on it in a `useEffect`, and imperatively toggles the root's className between a grid-classes string and a list-classes string inside `layout.update()`, looping on a `setTimeout` gated by an `IntersectionObserver` and a `prefers-reduced-motion` media query.

**Tech Stack:** Next.js 16 (App Router), React 18, TypeScript strict, Tailwind CSS, `animejs` 4.5.0 (new dependency).

## Global Constraints

- No new automated tests — this repo's Jest suite (`__tests__/`) is scoped entirely to `lib/parser/`; do not add React Testing Library or any component-test harness. Verification is manual against the dev server (exact steps in Task 3).
- `prefers-reduced-motion: reduce` must fully disable the effect — hard requirement, not optional polish.
- The animation loop must not run while the section is scrolled out of view (`IntersectionObserver`-gated).
- `npm run build`, `npm run lint`, and `npm test` must all pass after every task.
- Match existing code style: 'use client' first line, named exports (not default), no comments except where a non-obvious constraint requires one (see `CONTRIBUTING.md`'s own rule, already followed throughout this codebase).

---

### Task 1: Add the `animejs` dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: `animejs` v4.5.0 available for import as `import { createLayout, stagger } from 'animejs'`, with types `AutoLayout` also importable from the same specifier.

- [ ] **Step 1: Install the package**

Run (from the worktree/checkout you were told to work from — do not `cd` to any other path): `npm install animejs@4.5.0`

Expected: `package.json` gains `"animejs": "4.5.0"` (or `"^4.5.0"`, matching how other deps in this file are pinned — check `package.json`'s existing convention for exact-vs-caret before accepting npm's default) under `"dependencies"`, `package-lock.json` updates accordingly, exit code 0, no errors.

- [ ] **Step 2: Verify the package installed correctly**

Run: `npm ls animejs`
Expected: prints `animejs@4.5.0` with no `UNMET DEPENDENCY`/`invalid` warnings.

- [ ] **Step 3: Verify the exact API surface this plan relies on is present**

Run:
```bash
node -e "
const layoutDts = require('fs').readFileSync('node_modules/animejs/dist/modules/layout/layout.d.ts', 'utf8');
console.log(layoutDts.includes('export function createLayout') ? 'createLayout: OK' : 'createLayout: MISSING');
console.log(layoutDts.includes('revert(): this;') ? 'AutoLayout.revert: OK' : 'AutoLayout.revert: MISSING');
console.log(layoutDts.includes('update(callback: (layout: this) => void') ? 'AutoLayout.update: OK' : 'AutoLayout.update: MISSING');
"
```
Expected: all three lines print `OK`. (This plan's Task 3 code depends on exactly this API shape, confirmed against the installed 4.5.0 package before writing this plan — this step just re-confirms it landed the same way in your install.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add animejs dependency for homepage layout animation"
```

---

### Task 2: Extract the features grid into its own typed component (no animation yet)

Pure refactor — moves the existing static grid markup out of `app/page.tsx` into a new component with zero visual or behavioral change. This is its own task/commit so the animation work in Task 3 is a clean, reviewable diff on top of a verified-identical baseline.

**Files:**
- Create: `components/home/AnimatedFeaturesGrid.tsx`
- Modify: `app/page.tsx:1-8` (imports), `app/page.tsx:113-126` (replace inline grid with component usage)

**Interfaces:**
- Produces: `AnimatedFeaturesGrid` (named export) from `components/home/AnimatedFeaturesGrid.tsx`, taking `{ features: Feature[] }`, where `Feature = { icon: LucideIcon; title: string; desc: string }` (also exported from that file, matching the shape of the existing `features` const array already defined in `app/page.tsx`).
- Consumes: `LucideIcon` type from `lucide-react` (already a project dependency).

- [ ] **Step 1: Create the component with today's static markup**

Create `components/home/AnimatedFeaturesGrid.tsx`:

```tsx
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
```

- [ ] **Step 2: Wire it into `app/page.tsx`**

In `app/page.tsx`, change the import block (currently lines 1–6):

```tsx
import Link from 'next/link'
import { Zap, Clock, Share2, ArrowRight, MoveDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { DottedSurface } from '@/components/ui/DottedSurface'
```

to add one new import line:

```tsx
import Link from 'next/link'
import { Zap, Clock, Share2, ArrowRight, MoveDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { DottedSurface } from '@/components/ui/DottedSurface'
import { AnimatedFeaturesGrid } from '@/components/home/AnimatedFeaturesGrid'
```

Then replace the inline grid block (currently `app/page.tsx:113-126`):

```tsx
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
```

with:

```tsx
        <AnimatedFeaturesGrid features={features} />
```

- [ ] **Step 3: Verify the build and lint are clean**

Run: `npm run lint && npm run build`
Expected: both exit 0, no new warnings/errors. (`npm run build` also runs TypeScript, so this confirms `Feature`'s structural shape matches the existing `features` const array in `app/page.tsx`.)

- [ ] **Step 4: Manual visual check — must be pixel-identical to before**

Run: `npm run dev`, open `http://localhost:3000` in a browser, compare the features section against a screenshot/memory of the page before this change (three cards, same spacing, same hover behavior). There must be zero visible difference — this task only relocated markup.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/home/AnimatedFeaturesGrid.tsx
git commit -m "refactor: extract homepage features grid into its own component"
```

---

### Task 3: Add the createLayout animation loop

**Files:**
- Modify: `components/home/AnimatedFeaturesGrid.tsx` (the entire file — replacing Task 2's static version)

**Interfaces:**
- Consumes: `createLayout`, `stagger` (values) and `AutoLayout` (type) from `animejs` (installed in Task 1). `AutoLayout.update(callback: ({root}) => void, params) => Timeline` where `params` supports `duration`, `delay`, `onComplete`. `AutoLayout.revert() => this`.
- Produces: no new exports beyond Task 2's `AnimatedFeaturesGrid`/`Feature` — this task only changes the component's internals.

- [ ] **Step 1: Replace the component body with the animated version**

Replace the full contents of `components/home/AnimatedFeaturesGrid.tsx` with:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { createLayout, stagger } from 'animejs'
import type { AutoLayout } from 'animejs'
import type { LucideIcon } from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  title: string
  desc: string
}

interface Props {
  features: Feature[]
}

const GRID_CLASSES = 'grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left'
const LIST_CLASSES = 'flex flex-col gap-4 text-left list-view'
const TRANSITION_DURATION_MS = 700
const STAGGER_DELAY_MS = 80
const CYCLE_DWELL_MS = 1800

export function AnimatedFeaturesGrid({ features }: Props) {
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
        root.className = root.classList.contains('list-view') ? GRID_CLASSES : LIST_CLASSES
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
      root.className = GRID_CLASSES
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
```

Notes on why this shape, for whoever reviews it:
- `layout`, `timerId`, `observer`, `running`, `visible`, `isAnimating` are plain closure variables, not React state — none of this should trigger a re-render; it's all imperative DOM/animation bookkeeping, which matches how anime.js itself expects to be driven (imperative calls, not React-controlled className).
- `isAnimating` prevents a rapid intersection flicker (scroll past the section quickly) from calling `layout.update()` a second time while a transition is still in flight.
- `visible` (distinct from `running`) prevents the following race: the section scrolls out of view *while* a transition is mid-flight (before `onComplete` fires). The in-flight transition is allowed to finish naturally (not force-cancelled), but its `onComplete` checks `visible` before scheduling the next cycle, so it won't silently keep looping off-screen just because it happened to be mid-transition when the observer fired.
- `stop()` resets `root.className` back to `GRID_CLASSES` unconditionally — if reduced-motion is toggled on mid-list-view, the layout snaps back to the grid rather than freezing in whatever state it was mid-loop.

- [ ] **Step 2: Verify the build, lint, and existing tests are still clean**

Run: `npm run lint && npm test && npm run build`
Expected: all three exit 0. (`npm test` re-runs the untouched parser suite — this change has no parser surface, so this just confirms no regression.)

- [ ] **Step 3: Manual verification — default loop behavior**

Run: `npm run dev`, open `http://localhost:3000`, scroll the features section into view.
Expected: the three cards transition from the 3-column grid to a stacked full-width list and back, repeating roughly every ~2.5s (1.8s dwell + 0.7s transition), with a slight stagger between cards rather than all three moving in perfect lockstep.

- [ ] **Step 4: Manual verification — visibility gating**

With the dev server still running, scroll the features section fully out of view (e.g. scroll to the top of the page, well above the section) and wait ~5 seconds.
Expected: open the browser's Performance/Activity monitor or just observe — no further layout transitions should be visibly triggered while out of view. Scroll back down; the loop should resume within one dwell cycle.

- [ ] **Step 5: Manual verification — reduced motion**

In Chrome DevTools: Rendering tab → "Emulate CSS media feature prefers-reduced-motion" → `reduce`. Reload `http://localhost:3000`.
Expected: the features grid renders in its normal 3-column layout and never animates or toggles to the list layout.

Then, still with the emulation panel open, switch the emulated value back to "No emulation" without reloading the page.
Expected: the grid should start looping within a moment (the `change` event listener firing `start()`), confirming the runtime (not just initial-mount) media-query handling works.

- [ ] **Step 6: Manual verification — clean unmount**

With the dev server running and the animation actively looping on `/`, open the browser console, then click a link that navigates away client-side (e.g. "Start for free" → `/register`, or if logged in, "My flowcharts" → `/dashboard`) while a transition is likely mid-flight (click during the visible motion, not during a dwell pause).
Expected: no console errors or React warnings (e.g. no "Can't perform a React state update on an unmounted component" — note this component doesn't use React state for the animation at all, so this class of warning shouldn't be possible by construction, but confirm no other error appears, e.g. from anime.js itself).

- [ ] **Step 7: Commit**

```bash
git add components/home/AnimatedFeaturesGrid.tsx
git commit -m "feat: animate homepage features grid with anime.js createLayout"
```

---

## Self-Review Notes

- **Spec coverage:** dependency addition (Task 1) ✓, component extraction with identical output (Task 2) ✓, `createLayout` animation loop (Task 3 Step 1) ✓, `prefers-reduced-motion` gating both at mount and at runtime (Task 3 Step 1 + verified in Step 5) ✓, `IntersectionObserver` visibility gating (Task 3 Step 1 + verified in Step 4) ✓, cleanup on unmount via `revert()` (Task 3 Step 1 + verified in Step 6) ✓, no new automated tests / manual verification plan (Task 3 Steps 3–6, matching the spec's Testing section) ✓, build/lint/test gate after every task ✓.
- **Type consistency:** `Feature` is defined once in Task 2 and reused unchanged in Task 3 (same file, Task 3 replaces the whole file but keeps the identical interface). `AnimatedFeaturesGrid`'s prop name (`features`) matches what `app/page.tsx` passes in Task 2 Step 2. No signature drifts between tasks.
- **API accuracy:** `createLayout`, `AutoLayout.update`/`.revert()`, and `stagger` signatures were confirmed against the actually-installed `animejs@4.5.0` package's `.d.ts` files (not guessed from the docs excerpt alone) before this plan was written — see Task 1 Step 3, which re-verifies the same shape in the implementer's own install.
