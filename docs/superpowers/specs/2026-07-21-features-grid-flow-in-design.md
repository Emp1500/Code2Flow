# Homepage Features-Grid "Flow-In" Reveal — Design

**Date:** 2026-07-21
**Scope:** `components/home/AnimatedFeaturesGrid.tsx` (rewritten and renamed), `app/page.tsx` (import/usage), `package.json` (drop a dependency).
**Goal:** Replace the endlessly looping grid↔list layout morph with a single, meaningful entrance animation in which thin connector lines branch down from the hero illustration into the three feature cards, so the cards read as nodes in a flowchart. Static thereafter, with real hover states carrying the ongoing interaction.

## Background

`components/home/AnimatedFeaturesGrid.tsx` currently uses anime.js `createLayout` to flip the three feature cards between a 3-column grid (`GRID_CLASSES`) and a stacked list (`LIST_CLASSES`) every 1.8s, forever, while the section is on screen.

Two problems, per the user:

1. **The motion style is off.** The mechanical rearranging clashes with the rest of the page, which is calm and technical — mono type, thin `ring-1` borders, subtle color-only hovers.
2. **It is meaningless.** Grid→list says nothing about the product. Every other element on the landing page illustrates code→flowchart; this one is motion for its own sake. It also reflows page height on every cycle.

This spec replaces that motion with an entrance that reuses the page's own flowchart vocabulary — specifically the `w-px h-3 bg-border` connector and bordered-node idiom already present in the hero illustration at `app/page.tsx:80–96`.

## Non-goals

- **No changes to `DottedSurface`.** The Three.js background's hardcoded gray palette (`0.78, 0.78, 0.78`, `DottedSurfaceCanvas.tsx:59`) arguably also clashes with the navy/emerald theme, but the user scoped this work to the features grid. Out of scope.
- **No changes to the hero illustration** above the grid.
- **No new component-test infrastructure.** Jest here is `testEnvironment: 'node'` with no jsdom or React Testing Library; the suite covers parsers and API routes. Standing up a component-testing harness for one decorative animation is not justified. Verification is build/lint plus a manual pass (see Verification).
- **No new Tailwind keyframes.** Everything is a transition on existing theme tokens. See "Cut from the original proposal".
- **No user-facing toggle.** The reveal is automatic, gated only by viewport visibility and motion preference.

## Dependency removal

`animejs` (`^4.5.0`) is imported by exactly one file — this component (`createLayout`, `stagger`, and the `AutoLayout` type). Nothing else in the repo references it and no test covers it. The replacement uses only CSS transitions and `IntersectionObserver`, so `animejs` is removed from `package.json` dependencies and `package-lock.json` regenerated.

## Structure

The component is renamed `FeaturesGrid` in `components/home/FeaturesGrid.tsx`. The old name described the layout-morph behavior that is being deleted. `app/page.tsx` updates its import (line 7) and usage (line 99). The `features` array, card markup, icons, and copy are unchanged.

The component renders two siblings inside a wrapper that owns the reveal state:

```
wrapper  (data-anim, data-revealed)
├── connector layer   (hidden sm:block)
│   ├── stem     w-px, centered, top half
│   ├── bus      h-px, absolute, spans col-1 center → col-3 center
│   └── drops    grid grid-cols-3 — one w-px per column, bottom half
└── card grid   grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6
```

```
        ┌─ illustration above ─┐
                  │              ← stem
        ┌─────────┼─────────┐    ← bus
        │         │         │    ← drops
     ┌──┴──┐   ┌──┴──┐   ┌──┴──┐
     │card │   │card │   │card │
     └─────┘   └─────┘   └─────┘
```

### Why divs and not SVG

An SVG overlay would need a `viewBox` matched to the grid's rendered width, which means measuring on mount and on resize, and either distorted strokes (`preserveAspectRatio="none"`) or recomputed path data per breakpoint.

The drop row instead reuses the card grid's own `grid-cols-3` template, so each drop sits at its column's center at any viewport width with no measurement and no resize listener. The bus is a single absolutely-positioned `h-px` element inset by half a column on each side. All of it uses `bg-border`, matching the existing connector idiom.

### Responsive behavior

Below the `sm:` breakpoint the card grid collapses to one column, where a three-way branch is meaningless. The entire connector layer is `hidden sm:block`. On mobile the cards perform the staggered fade-up on their own.

The connector layer is carved out of the space currently held by the grid's `mt-16 sm:mt-20` top margin, so total page spacing is unchanged. Because the layer is `hidden` below `sm:` it contributes no height there, and the wrapper's margin absorbs the difference:

| Breakpoint | Wrapper margin | Connector height | Total gap | Was |
|------------|----------------|------------------|-----------|-----|
| base | `mt-16` (4rem) | 0 — layer hidden | 4rem | 4rem ✓ |
| `sm:` | `sm:mt-8` (2rem) | `h-12` (3rem) | 5rem | 5rem ✓ |

So the wrapper carries `mt-16 sm:mt-8` and the connector layer `hidden sm:block h-12`. The old `mt-16 sm:mt-20` is removed from the card grid.

## Motion

One-shot, triggered the first time the wrapper intersects the viewport.

| Start | Element | Change | Duration |
|-------|---------|--------|----------|
| 0ms | stem | `scaleY(0→1)`, `origin-top` | 220ms |
| 180ms | bus | `scaleX(0→1)`, `origin-center` | 320ms |
| 440ms | drops ×3 | `scaleY(0→1)`, `origin-top`, 90ms stagger | 200ms |
| 560ms | cards ×3 | `opacity 0→1` + `translateY(12px→0)`, 90ms stagger | 420ms |

Total ≈1.2s. Easing is `ease-out` throughout. Each card starts its fade-up as its own drop lands, so the line visibly arrives and the card appears in response.

### Mechanism

The wrapper is a client component. An `IntersectionObserver` (threshold `0.25`) sets `data-revealed` on the wrapper on first intersection and then calls `disconnect()`. Every step above is a CSS transition selected by `[data-revealed]` with a per-element `transition-delay` supplying the offsets in the table.

There is no `requestAnimationFrame` loop, no timer chain, and no repeat. After ~1.2s the section is completely static and the component does no further work.

### Cut from the original proposal

The proposal to the user included a brief icon-chip brighten (`bg-primary/10 → bg-primary/20 → bg-primary/10`) as each card lands. Implementing a there-and-back pulse requires a Tailwind keyframe, which contradicts the "no config changes" constraint agreed in this design. The entrance is already carried by the connectors and the fade-up, so the pulse is cut. It can be added later as a single `@keyframes` entry if wanted.

## States

### Initial / no-JS

The server-rendered HTML is the pre-reveal state (connectors at scale 0, cards at `opacity-0`), so there is no flash of final-state content before the observer fires.

That means a visitor with JavaScript disabled would otherwise see three permanently invisible cards. The component therefore renders a `<noscript><style>` block that forces the final revealed state (`opacity: 1`, `transform: none`) for the wrapper's descendants. This is the correctness requirement of the whole design, not a nicety.

### Reduced motion

`prefers-reduced-motion: reduce` is read once on mount. If set, `data-revealed` is applied immediately and the observer is never created. Every transition utility carries Tailwind's built-in `motion-safe:` variant, so these users land on the final state with no tweening.

Unlike the current component, live changes to the media query are **not** handled. For a one-shot entrance that has already completed, re-running on preference change has no user-visible payoff and only adds a listener to maintain.

### Hover / resting

Ongoing interaction moves from ambient motion to hover response. Each card becomes a `group`:

| Property | Rest | Hover |
|----------|------|-------|
| ring | `ring-border/60` | `ring-primary/40` |
| background | `bg-card/70` | `bg-card` |
| transform | none | `-translate-y-0.5` |
| icon chip | `bg-primary/10` | `bg-primary/20` (via `group-hover`) |

200ms, on `background-color`, `box-shadow`, and `transform`. This replaces the current `hover:bg-card hover:ring-border`.

## Verification

No automated test is added, for the reason given in Non-goals. Verification is:

1. `npm run lint` — clean.
2. `npm run build` — succeeds; confirms the removed `animejs` import breaks nothing.
3. `npm test` — the existing suite passes unchanged, confirming no regression elsewhere.
4. Manual pass under `npm run dev`:
   - Desktop width: scrolling the features section into view plays the branch-then-cards sequence once and does not repeat on scroll away and back.
   - Below `sm:`: connector layer absent, cards fade up in sequence, no horizontal overflow.
   - Drops align with card centers at several viewport widths between `sm:` and `2xl`.
   - Reduced motion forced in devtools: section is fully visible immediately, no tweening.
   - JavaScript disabled: all three cards visible and readable.
   - Total page height is stable while the section is on screen (the defect the old loop introduced).

Actual command output is reported rather than asserted.

## Risks

- **Drop/column alignment** is the one place this can look wrong. It depends on the drop row and the card grid sharing an identical `grid-cols-3` + `gap` template. If the card grid's gap ever changes without the connector row following, the drops drift off-center. Mitigated by defining the shared grid classes as a single constant used by both rows.
- **Connector layer height** is fixed (`h-12`, balanced against the wrapper's `sm:mt-8`). If the hero illustration above ever gains a bottom margin, the stem will appear detached from it. Cosmetic, not a functional break.
