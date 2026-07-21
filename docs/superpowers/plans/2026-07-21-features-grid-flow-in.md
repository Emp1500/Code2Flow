# Features-Grid "Flow-In" Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's endlessly looping grid↔list layout morph with a one-shot connector reveal in which thin lines branch down from the hero illustration into the three feature cards.

**Architecture:** A client component wraps a decorative connector layer (plain `div`s using the page's existing `w-px bg-border` idiom) above the card grid. An `IntersectionObserver` sets `data-revealed` on the wrapper once, then disconnects; every animation step is a CSS transition selected via Tailwind's `group-data-[revealed]/reveal:` variant with per-element `transition-delay`. No animation library, no rAF, no timers.

**Tech Stack:** Next.js 16, React 18, TypeScript, Tailwind CSS 3.4.19, `lucide-react`. The `animejs` dependency is removed.

**Spec:** `docs/superpowers/specs/2026-07-21-features-grid-flow-in-design.md`

## Global Constraints

- **No changes to `tailwind.config.ts`.** No new keyframes, colors, or plugins. Everything is a transition on existing theme tokens.
- **No changes to `components/ui/DottedSurfaceCanvas.tsx`** or the hero illustration in `app/page.tsx:56–97`. Out of scope.
- **No new test infrastructure.** `jest.config.js` is `testEnvironment: 'node'` with no jsdom or React Testing Library. This plan adds no component tests; verification is lint + build + a manual checklist (Task 3). Do not add RTL/jsdom.
- **Feature copy is unchanged.** The three `title`/`desc` strings and their icons (`Zap`, `Clock`, `Share2`) are carried over verbatim.
- **Commit messages must NOT include a `Co-Authored-By` trailer.**
- Entrance transforms and hover transforms must never live on the same element — see Task 1, Step 2 rationale.

---

### Task 1: Replace the component with the flow-in reveal

**Files:**
- Create: `components/home/FeaturesGrid.tsx`
- Delete: `components/home/AnimatedFeaturesGrid.tsx`
- Modify: `app/page.tsx:7` (import), `app/page.tsx:99` (usage)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export function FeaturesGrid(): JSX.Element` — takes no props, owns its own `features` array internally (same as the component it replaces). Also re-exports `export interface Feature { icon: LucideIcon; title: string; desc: string }`.

- [ ] **Step 1: Create the new component file**

Create `components/home/FeaturesGrid.tsx`:

```tsx
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
```

- [ ] **Step 2: Confirm the two-element split is intact**

This is the step that keeps the hover states working. Verify by reading the file:

1. The element carrying `style={{ transitionDelay: ... }}` and `opacity-0 translate-y-3` has **no** `hover:` class.
2. The element carrying `hover:-translate-y-0.5` has **no** `transitionDelay` and **no** `group-data-[revealed]` class.

If entrance and hover share one element, two bugs appear: `.group\/reveal[data-revealed] .card` (specificity 0,3,0) outranks `.card:hover` (0,2,0) so the lift never renders, and the 560–740ms entrance delay also delays the hover response.

- [ ] **Step 3: Point the page at the new component**

In `app/page.tsx`, change line 7 from:

```tsx
import { AnimatedFeaturesGrid } from '@/components/home/AnimatedFeaturesGrid'
```

to:

```tsx
import { FeaturesGrid } from '@/components/home/FeaturesGrid'
```

and line 99 from:

```tsx
        <AnimatedFeaturesGrid />
```

to:

```tsx
        <FeaturesGrid />
```

- [ ] **Step 4: Delete the old component**

```bash
git rm components/home/AnimatedFeaturesGrid.tsx
```

- [ ] **Step 5: Verify nothing still references the old name**

```bash
grep -rn "AnimatedFeaturesGrid" --include="*.tsx" --include="*.ts" . | grep -v node_modules
```

Expected: no output. Any hit is a broken import — fix it before continuing.

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: `tsc` prints nothing; `npm run lint` exits 0 with no errors. A `react/no-danger` warning on the `<noscript>` block would be acceptable, but this repo's `eslint.config.mjs` does not enable that rule, so expect a clean run.

- [ ] **Step 7: Build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`, and `/` still listed in the route table. Report the actual tail of the output.

- [ ] **Step 8: Commit**

```bash
# `git rm` in Step 4 already staged the deletion.
git add components/home/FeaturesGrid.tsx app/page.tsx
git commit -m "feat: replace looping features grid morph with flow-in reveal

Cards now read as flowchart nodes: a stem, bus, and three drops branch
down from the hero illustration and each card fades up as its drop
lands. One-shot on scroll into view, static thereafter, with hover
states carrying ongoing interaction."
```

---

### Task 2: Drop the animejs dependency

**Files:**
- Modify: `package.json` (remove `animejs` from `dependencies`)
- Modify: `package-lock.json` (regenerated)

**Interfaces:**
- Consumes: Task 1 must be complete — `components/home/AnimatedFeaturesGrid.tsx` was the only importer of `animejs`, and it no longer exists.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm nothing imports animejs**

```bash
grep -rn "animejs" --include="*.tsx" --include="*.ts" . | grep -v node_modules
```

Expected: no output. If anything is returned, stop — Task 1 is incomplete or another consumer appeared.

- [ ] **Step 2: Remove the dependency**

```bash
npm uninstall animejs
```

Expected: npm removes the package and rewrites `package.json` and `package-lock.json`.

- [ ] **Step 3: Confirm it left package.json**

```bash
grep -n "animejs" package.json
```

Expected: no output (grep exits 1).

- [ ] **Step 4: Rebuild to prove the removal broke nothing**

```bash
npm run build
```

Expected: `✓ Compiled successfully`. This is the real check that no runtime path still reached for the library.

- [ ] **Step 5: Run the existing suite for regression**

```bash
npm test
```

Expected: all existing parser/route suites pass. They do not touch this component, so any failure here is unrelated to this work and must be reported, not silently accepted.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: drop animejs dependency

The features grid was its only consumer and no longer uses it."
```

---

### Task 3: Manual verification pass

**Files:** none modified unless a defect is found.

**Interfaces:**
- Consumes: Tasks 1 and 2 complete and committed.
- Produces: a pass/fail report for each check below.

This task adds no automated test, for the reason recorded in Global Constraints. These checks are the verification. Run every one and report the real result — if a check fails, fix it, re-run the whole list, and amend or add a commit.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: server ready on `http://localhost:3000`.

- [ ] **Step 2: Desktop entrance check**

Load `http://localhost:3000` at a viewport ≥1024px wide, scrolled to the top. Scroll the features section into view.

Expected, in order: the centre stem draws downward, the horizontal bus opens outward from centre, three vertical drops fall left-to-right, and each card fades up as its own drop lands. Total ≈1.2s.

- [ ] **Step 3: One-shot check**

Scroll well past the features section, then scroll back up to it.

Expected: no replay. The cards and connectors stay in their final state. This is the specific defect the old component had — if it re-animates, `observer.disconnect()` is not being reached.

- [ ] **Step 4: Column alignment check**

At viewport widths of roughly 640px, 768px, 1024px, 1280px, and 1536px, look at where the three drops meet the cards.

Expected: each drop meets the horizontal centre of its card at every width. Drift means `CONNECTOR_COLUMNS`'s `gap-6` and `CARD_COLUMNS`'s `sm:gap-6` have diverged, or `BUS_INSET` no longer matches the gap.

- [ ] **Step 5: Mobile check**

Narrow the viewport below 640px.

Expected: no connector layer at all; the three cards stack and fade up in sequence; no horizontal page scrollbar.

- [ ] **Step 6: Spacing regression check**

The gap between the hero illustration and the first feature card must be unchanged from before this work: 4rem below `sm:`, 5rem at `sm:` and up.

In devtools, select the wrapper (`.group\/reveal`) and read its computed `margin-top`, then select the connector layer and read its computed `height`. Add them.

Expected: `64px + 0px = 64px` below `sm:`; `32px + 48px = 80px` at `sm:` and up.

- [ ] **Step 7: Hover check**

Hover each card.

Expected: the ring shifts to emerald (`ring-primary/40`), the background solidifies, the card lifts ~2px, and the icon chip brightens — **immediately**, with no delay. A visible lag before the hover responds means the entrance `transitionDelay` leaked onto the hover element (see Task 1, Step 2).

- [ ] **Step 8: Reduced-motion check**

In Chrome devtools open the command palette (Ctrl/Cmd+Shift+P), run "Emulate CSS prefers-reduced-motion: reduce", then hard-reload.

Expected: the section is fully visible immediately — connectors at full length, cards fully opaque — with no tweening at any point.

- [ ] **Step 9: No-JS check**

In devtools settings, disable JavaScript, then hard-reload.

Expected: all three feature cards are visible and readable. If they are invisible, the `<noscript>` block is not applying — confirm it rendered into the HTML and that `data-reveal` is present on the card wrappers.

- [ ] **Step 10: Page-height stability check**

With the features section on screen, watch the scrollbar thumb for ~10 seconds.

Expected: total page height never changes. The old component reflowed the page every 1.8s; nothing should move once the entrance completes.

- [ ] **Step 11: Report**

Report each of Steps 2–10 as pass or fail with what was actually observed. Do not report a check as passing without having run it.

---

## Notes for the implementer

**Why there is no unit test.** `jest.config.js` sets `testEnvironment: 'node'` and the repo has no jsdom or React Testing Library. This component is presentational and its entire behaviour is CSS transitions plus one `IntersectionObserver` call. Standing up a component-test harness for it was explicitly ruled out in the approved spec. Do not add one as a surprise.

**Tailwind variants used here were verified against this repo's config**, not assumed:
- `group-data-[revealed]/reveal:scale-y-100` → `.group\/reveal[data-revealed] .child`
- `group-hover/card:bg-primary/20` → `.group\/card:hover .child`

Named groups (`/reveal`, `/card`) are required. With unnamed `group` on both the wrapper and the card, the icon chip's `group-hover` would also fire when hovering anywhere in the section.

**All Tailwind classes must stay literal strings in the file.** Tailwind scans source text, so a dynamically composed class name (e.g. `` `scale-y-${n}` ``) produces no CSS. The `CONNECTOR_COLUMNS` / `CARD_COLUMNS` constants are fine because their contents are literal text in this file.
