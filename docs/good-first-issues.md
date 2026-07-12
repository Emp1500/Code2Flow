# Good First Issues — ready to file

Maintainer notes: paste each of these as a GitHub issue with the listed labels.
Create the `good first issue` and `help wanted` labels first if they don't
exist (GitHub creates `good first issue` by default). Delete this file once
they're filed.

---

## 1. `timeAgo` says "1 minutes ago"

**Labels:** `bug`, `good first issue`

`timeAgo()` in `components/dashboard/FlowchartCard.tsx` doesn't singularize
units: a flowchart updated 90 seconds ago shows **"1 minutes ago"**, and the
same happens for "1 hours ago" and "1 days ago".

**Fix:** pluralize based on the computed value (`1 minute ago` / `2 minutes
ago`), keeping the existing thresholds. A tiny pure function — a good
candidate for a first unit test in `__tests__/` too.

---

## 2. "Copy link" gives no feedback

**Labels:** `enhancement`, `good first issue`

`handleShareCopy()` in `components/editor/EditorToolbar.tsx` writes the share
URL to the clipboard silently. The user has no way to know it worked.

**Fix:** show brief visual confirmation — e.g. swap the button label/icon to
"Copied ✓" for ~2 seconds, or add a toast. Follow the existing button
patterns in the toolbar; no new dependency needed.

---

## 3. No rate limit on rename and delete API routes

**Labels:** `security`, `good first issue`

In `app/api/flowcharts/[id]/route.ts`, `PUT` checks `checkRateLimit(saveLimit,
user.id)` but `PATCH` (rename) and `DELETE` don't — they can be called without
any throttle.

**Fix:** add the same `checkRateLimit` guard (with the 429 + `Retry-After`
response) to both handlers, mirroring the `PUT` implementation. See
`lib/rate-limit.ts` for the limiter setup.

---

## 4. Replace native `confirm()` dialogs with the app's Dialog component

**Labels:** `enhancement`, `ui`, `good first issue`

Three places still use the browser's native `confirm()`:

- `components/dashboard/FlowchartCard.tsx` — delete confirmation
- `components/editor/EditorToolbar.tsx` — "Save before leaving?" and delete

Native dialogs clash with the app's dark theme and can't be styled. The
project already ships `components/ui/dialog.tsx` (shadcn) — use it for a
proper confirmation dialog with a destructive-styled action button.

---

## 5. Card options menu can't be closed with Escape

**Labels:** `accessibility`, `good first issue`

The "more options" dropdown in `components/dashboard/FlowchartCard.tsx` is a
hand-rolled menu: it closes on outside click but not on `Escape`, and focus
isn't returned to the trigger button. Keyboard users get stuck.

**Fix:** add an `Escape` key handler that closes the menu and refocuses the
trigger. Bonus: `aria-expanded` on the trigger and `role="menu"` /
`role="menuitem"` on the popup.

---

## 6. Parser: add tests for nested and mixed control flow

**Labels:** `testing`, `parser`, `good first issue`

Test coverage in `__tests__/` is thin relative to parser complexity. Missing
cases include: a loop containing `try/except` containing `if/elif`, `switch`
with fall-through, nested functions, and malformed input (unclosed braces,
mixed indentation in Python).

**Fix:** pick one or two of these shapes and add cases to the parser test
suite. Assert on graph *connectivity* (every node reachable, no dangling
edges), not just "it didn't throw" — a broken flowchart still renders, it
just renders wrong.

---

## 7. Editor toolbar overflows on narrow screens

**Labels:** `bug`, `ui`, `help wanted`

`components/editor/EditorToolbar.tsx` renders ~12 buttons in a single
non-wrapping row. Below ~900px viewport width, buttons overflow and become
unreachable — there's no responsive fallback.

**Fix idea:** collapse lower-priority actions (Save As, History, PNG, Delete)
into an overflow "⋯" menu below a breakpoint, keeping New/Save/Share always
visible. Needs some design judgment, hence `help wanted` rather than
`good first issue`.

---

## 8. Defense-in-depth: explicit ownership checks in API routes

**Labels:** `security`, `help wanted`

Access control currently relies 100% on Postgres RLS (correct today, but a
single point of failure — see README "Known Limitations"). The route handlers
in `app/api/flowcharts/**` never verify `flowchart.user_id === user.id` in
application code.

**Fix:** in each mutating handler, fetch the row's `user_id` first and return
403 on mismatch before performing the write. Pure hardening — behavior
shouldn't change for legitimate requests. Explain the access-control
reasoning in the PR description per CONTRIBUTING.md.
