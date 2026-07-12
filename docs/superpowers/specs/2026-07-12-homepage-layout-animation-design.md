# Homepage Features-Grid Layout Animation — Design

**Date:** 2026-07-12
**Scope:** `app/page.tsx`, new `components/home/AnimatedFeaturesGrid.tsx`, `package.json` (new dependency).
**Goal:** Use anime.js's `createLayout` (Auto Layout) to animate the homepage's 3-card features section between a grid layout and a stacked list layout, looping continuously and tastefully while the section is visible, with zero regression for users who don't want motion.

## Background

The homepage (`app/page.tsx`) currently renders a static 3-column grid of feature cards (`features.map(...)`, lines 113–126). No animation library is installed in this project today. The user asked specifically for anime.js's Layout feature (`createLayout`), which FLIP-animates a container between two computed layout states (e.g. `display`, `flex-direction`, grid column count, DOM order) rather than animating individual CSS properties by hand.

## Non-goals

- No changes to the code→flowchart hero illustration section — this spec only touches the features grid below it.
- No new automated test infrastructure (React Testing Library, jsdom component tests) — this repo's test suite is Jest-parser-only by design; adding a component-testing harness for one decorative animation is out of scope. Verification is manual (see Testing below).
- No user-facing toggle/control — the animation is decorative and fully automatic, gated only by visibility and motion preference, not by user interaction.

## Dependency

Add `animejs` (latest, currently a `^4.x` line per the docs the user supplied) to `package.json` `dependencies`. Import from the main entry point:

```ts
import { createLayout, stagger } from 'animejs'
```

The main entry (not the `animejs/layout` subpath) is used because `stagger` is needed for the per-card animation delay and its availability from the layout-only subpath isn't confirmed; the main entry is what the reference example imports from and is guaranteed to expose both.

## Component

New file: `components/home/AnimatedFeaturesGrid.tsx`, `'use client'`.

```ts
interface Props {
  features: { icon: LucideIcon; title: string; desc: string }[]
}
```

`app/page.tsx` passes its existing `features` array through unchanged and replaces the current inline grid `<div>`/`.map()` block with `<AnimatedFeaturesGrid features={features} />`. `app/page.tsx` itself stays a server component — only the new child is a client boundary.

Internally, the component renders the same markup/classes as today's grid (`grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6`) inside a `ref`-attached root, plus a second CSS state for the list layout (e.g. a `.list-view` class override to `flex flex-col gap-4`), defined as a Tailwind-compatible conditional class rather than new global CSS.

## Animation lifecycle

1. **Mount check:** `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. If `true`, skip everything below — render the static grid, no `createLayout` call, no observer, no timers. This must also react to the media query changing at runtime (attach a `change` listener) rather than only checking once at mount, so a user who toggles the OS setting mid-session doesn't need to reload.
2. **Setup (motion allowed):** `createLayout(rootRef.current)` once. Create an `IntersectionObserver` on the same root element.
3. **Loop, gated by intersection:** while the observer reports the root as intersecting, run a self-recursive loop:
   ```ts
   function cycle() {
     layout.update(({ root }) => root.classList.toggle('list-view'), {
       duration: 700,
       delay: stagger(80),
       onComplete: () => { timerId = setTimeout(cycle, 1800) },
     })
   }
   ```
   `1800ms` is a dwell time in each state before the next transition — a continuous instant toggle would read as flickering, not "alive." Exact duration/dwell values are tunable during implementation/visual review, not load-bearing to the design.
4. **Visibility changes:** when the observer reports the root leaving the viewport, clear the pending `setTimeout` and do not start a new `layout.update()` call (in-flight animations are allowed to finish, just not rescheduled). When it re-enters, resume the loop from the observer callback.
5. **Cleanup on unmount:** disconnect the `IntersectionObserver`, clear any pending `setTimeout`, and stop the animation. The exact API to halt an in-flight `layout.update()`/the `AutoLayout` instance itself (e.g. a `.revert()` or `.pause()` method) is not fully specified by the docs excerpt the user provided — implementation must check the installed package's type definitions and use whatever the real API offers; if no explicit stop method exists, guard with an `isMounted`/generation-counter ref so a late `onComplete` firing after unmount is a no-op instead of touching a detached DOM node.

## Data flow / error handling

No new data flow — `features` is the same static array already defined in `app/page.tsx`, no network/async involved. The only failure surface is client-side animation misbehavior; because the grid/list layouts are expressed as plain CSS classes, the content is correctly readable and laid out even if `createLayout` throws, never loads, or is skipped entirely (progressive enhancement — the animation is additive polish, not load-bearing for the page to function).

## Accessibility & performance

- `prefers-reduced-motion: reduce` fully disables the effect (see lifecycle step 1) — this is a hard requirement, not a nice-to-have.
- `IntersectionObserver` gating means the loop never runs while scrolled out of view, avoiding wasted CPU/battery on a marketing page users may leave open in a background tab.
- The toggled class only changes layout (`display`/`flex-direction`/grid columns) — no content, text, or interactive elements change between states, so screen-reader announcements aren't affected by the transition itself.

## Testing

No new automated tests — this repo's Jest suite is scoped to `lib/parser/`, and standing up a component-testing framework for one decorative animation would be disproportionate scope creep. Verification is manual against the dev server:

1. Default: confirm the grid↔list loop plays continuously while the section is in view.
2. Scroll the section out of view, confirm the loop pauses (no console activity, no CPU churn); scroll back, confirm it resumes.
3. Simulate `prefers-reduced-motion: reduce` (browser devtools emulation), confirm the grid renders statically with no animation and no `createLayout` call.
4. Unmount path: navigate away from `/` while the animation is mid-cycle (client-side nav to another route), confirm no console errors/warnings about updating an unmounted component.
5. `npm run build`, `npm run lint`, `npm test` all still pass (existing parser suite untouched by this change).
