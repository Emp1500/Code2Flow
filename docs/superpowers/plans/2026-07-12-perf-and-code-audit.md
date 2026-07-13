# Performance & Code Audit Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the concrete performance, bundle-size, dead-weight-dependency, and type-safety issues found in a full-repo audit (2026-07-12), without changing any user-visible behavior.

**Architecture:** Each task is an independent, low-risk change: either (a) defer a heavy client-only library behind `next/dynamic`, (b) remove/relocate a dependency in `package.json`, (c) parallelize independent Supabase calls, or (d) tighten types in the parser. No task depends on another; they can be done in any order or split across subagents.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 18, TypeScript, Supabase, Jest.

## Global Constraints

- Do not change any visible UI behavior, route, or API response shape — this is a non-functional cleanup pass.
- Every task must end with `npm run build` succeeding and `npm test` passing (baseline: all `__tests__/*.test.ts` green).
- Do not touch RLS/SQL, auth flow, or the Content-Security-Policy in `next.config.js`.
- Preserve existing `next-env.d.ts` / `*.tsbuildinfo` gitignore behavior (already correct — no action needed there).

---

## Audit Findings Summary (context for all tasks)

Verified via `npm run build` + manifest inspection + grep on 2026-07-12:

1. **`components/ui/DottedSurface.tsx`** statically imports `three` (`import * as THREE from 'three'`). The compiled chunk is 516 KB and is confirmed present in the client reference manifests for `/`, `/login`, and `/register` (the three highest-traffic, unauthenticated entry pages) — confirmed absent from `/dashboard`. It renders a decorative animated background only, with no SSR-dependent output.
2. Zero uses of `next/dynamic` anywhere in the repo — Monaco (`components/editor/CodeEditor.tsx`, `components/share/ShareView.tsx`) and Mermaid (`components/editor/FlowchartPanel.tsx`) are statically imported too. These are already route-isolated by the App Router (not loaded on `/`, `/login`, `/dashboard`), so lower priority than #1, but still block-render their host component instead of streaming in behind a loading state.
3. `package.json` lists `next-themes` (0 references anywhere in `app/`, `components/`, `lib/`, or CSS) and `tw-animate-css` (0 references — only `tailwindcss-animate` is actually used, in `tailwind.config.ts`) as runtime dependencies. Both are dead weight in `node_modules` and install time.
4. `shadcn` (the scaffolding CLI, never imported in source) and `@types/three` (a types-only package) are declared under `dependencies` instead of `devDependencies`, bloating the production dependency tree unnecessarily.
5. `lib/parser/javascript.ts` and `lib/parser/typescript.ts` both open with `/* eslint-disable @typescript-eslint/no-explicit-any */` and together account for 47 of the repo's 52 `any`/`as any` occurrences — the core parsing engine has type-checking effectively turned off.
6. `app/api/flowcharts/[id]/route.ts` `GET` handler issues two independent Supabase queries (`flowcharts` lookup, then latest `flowchart_versions` lookup) sequentially with `await`, even though neither depends on the other's result — an unnecessary serial round-trip on every editor/share page load.

---

### Task 1: Lazy-load the Three.js background on marketing pages

**Files:**
- Modify: `components/ui/DottedSurface.tsx`
- Test: manual build verification (no existing unit test touches this component)

**Interfaces:**
- Consumes: nothing new.
- Produces: same default export `DottedSurface` component, same props — callers (`app/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`) do not change.

- [ ] **Step 1: Read the current component to confirm props/shape**

Run: `sed -n '1,40p' components/ui/DottedSurface.tsx`
Confirm it's a self-contained `'use client'` component with no required props (or note the props if any exist) before splitting it.

- [ ] **Step 2: Split into a static wrapper + a dynamically-imported Three.js implementation**

Rename the current file's contents into `components/ui/DottedSurfaceCanvas.tsx` (same code, same `'use client'` directive, same export name but exported as `DottedSurfaceCanvas`), then replace `components/ui/DottedSurface.tsx` with:

```tsx
'use client'

import dynamic from 'next/dynamic'

const DottedSurfaceCanvas = dynamic(
  () => import('./DottedSurfaceCanvas').then(mod => mod.DottedSurfaceCanvas),
  { ssr: false }
)

export function DottedSurface(props: React.ComponentProps<typeof DottedSurfaceCanvas>) {
  return <DottedSurfaceCanvas {...props} />
}
```

Adjust the prop type / import path to match whatever `DottedSurfaceCanvas`'s actual prop signature is from Step 1 (e.g. if it takes a `className` prop, keep that typed explicitly instead of `React.ComponentProps` if simpler).

- [ ] **Step 3: Build and confirm the three.js chunk is no longer in the `/`, `/login`, `/register` client reference manifests**

Run:
```bash
npm run build
grep -o "THREE\|three" .next/server/app/page_client-reference-manifest.js | head -1
```
Expected: the three.js chunk filename referenced by `page_client-reference-manifest.js` for `/` is a *different* (smaller, dynamically-loaded) chunk than before, and does not block the initial page chunk list. Confirm visually that `app/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx` still render the dotted background by running `npm run dev` and opening `/`, `/login`, `/register` in a browser — the background should still animate, just appear a beat after first paint.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all existing tests pass unchanged (this component has no unit tests, so this just guards against unrelated breakage).

- [ ] **Step 5: Commit**

```bash
git add components/ui/DottedSurface.tsx components/ui/DottedSurfaceCanvas.tsx
git commit -m "perf: lazy-load three.js DottedSurface background via next/dynamic"
```

---

### Task 2: Remove dead dependencies and relocate dev-only ones

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerated by `npm install`, not hand-edited)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm zero usage one more time immediately before removing**

Run:
```bash
grep -rn "next-themes" --include='*.ts*' --include='*.css' --include='*.mjs' . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git
grep -rn "tw-animate-css" --include='*.ts*' --include='*.css' --include='*.mjs' . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git
grep -rn "from 'shadcn'\|from \"shadcn\"" app components lib --include='*.ts*'
```
Expected: no output for any of the three commands.

- [ ] **Step 2: Remove `next-themes` and `tw-animate-css`, move `shadcn` and `@types/three` to devDependencies**

```bash
npm uninstall next-themes tw-animate-css
npm uninstall shadcn @types/three
npm install --save-dev shadcn @types/three
```

- [ ] **Step 3: Verify `package.json` dependency lists**

Run: `cat package.json`
Expected: `dependencies` no longer contains `next-themes`, `tw-animate-css`, `shadcn`, or `@types/three`; `devDependencies` now contains `shadcn` and `@types/three`.

- [ ] **Step 4: Rebuild and retest to confirm nothing depended on the removed packages**

Run:
```bash
npm run build
npm test
```
Expected: both succeed with no module-not-found errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: drop unused next-themes/tw-animate-css deps, move shadcn/@types/three to devDependencies"
```

---

### Task 3: Parallelize independent Supabase reads in the flowchart GET route

**Files:**
- Modify: `app/api/flowcharts/[id]/route.ts:8-27`
- Test: `__tests__` has no existing coverage for this route; add a focused test.

**Interfaces:**
- Consumes: existing `createClient` from `@/lib/supabase/server`.
- Produces: same `GET` response shape (`{ ...flowchart fields, code, version_number }`) — no external interface change.

- [ ] **Step 1: Write a failing test asserting both queries fire without waiting on each other**

Create `__tests__/flowcharts-get-route.test.ts`:

```ts
import { GET } from '@/app/api/flowcharts/[id]/route'

const flowchartsQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
}
const versionsQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: (table: string) => (table === 'flowcharts' ? flowchartsQuery : versionsQuery),
  })),
}))

describe('GET /api/flowcharts/[id]', () => {
  it('issues the flowchart and version lookups concurrently', async () => {
    let flowchartResolved = false
    let versionStartedBeforeFlowchartResolved = false

    flowchartsQuery.single.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => {
            flowchartResolved = true
            resolve({ data: { id: 'fc-1', user_id: 'user-1' }, error: null })
          }, 20)
        )
    )
    versionsQuery.single.mockImplementation(() => {
      versionStartedBeforeFlowchartResolved = !flowchartResolved
      return Promise.resolve({ data: { code: 'x', version_number: 3 }, error: null })
    })

    const request = new Request('http://localhost/api/flowcharts/fc-1')
    const response = await GET(request, { params: Promise.resolve({ id: 'fc-1' }) })
    const body = await response.json()

    expect(versionStartedBeforeFlowchartResolved).toBe(true)
    expect(body).toMatchObject({ id: 'fc-1', code: 'x', version_number: 3 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails against the current sequential implementation**

Run: `npx jest __tests__/flowcharts-get-route.test.ts -v`
Expected: FAIL — `versionStartedBeforeFlowchartResolved` is `false` because today's code `await`s the flowchart query before starting the version query.

- [ ] **Step 3: Parallelize the two independent queries with `Promise.all`**

In `app/api/flowcharts/[id]/route.ts`, replace the `GET` handler body (currently sequential `await`s for `fc` then `versionRes`) with:

```ts
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: fc, error }, versionRes] = await Promise.all([
    supabase.from('flowcharts').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase
      .from('flowchart_versions')
      .select('code, version_number')
      .eq('flowchart_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single(),
  ])
  if (error || !fc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const version = versionRes.data as { code: string; version_number: number } | null

  return NextResponse.json(Object.assign({}, fc, { code: version?.code ?? '', version_number: version?.version_number ?? 0 }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/flowcharts-get-route.test.ts -v`
Expected: PASS

- [ ] **Step 5: Run full suite and build**

Run:
```bash
npm test
npm run build
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app/api/flowcharts/\[id\]/route.ts __tests__/flowcharts-get-route.test.ts
git commit -m "perf: parallelize flowchart+version reads in GET /api/flowcharts/[id]"
```

---

### Task 4: Re-enable type checking in the parser and eliminate `any`

**Files:**
- Modify: `lib/parser/javascript.ts` (41 `any` occurrences)
- Modify: `lib/parser/typescript.ts` (5 `any` occurrences)
- Modify: `lib/parser/python.ts` (6 `any` occurrences)
- Test: existing `__tests__/parser-js-accuracy.test.ts`, `__tests__/parser-python-accuracy.test.ts`, `__tests__/parser.test.ts` already cover parser behavior and must stay green throughout — this task is a pure typing refactor with no behavior change.

**Interfaces:**
- Consumes: `acorn.Node` / `acorn.Program` types from `acorn`, and whatever AST node shapes `acorn-typescript` exports.
- Produces: same exported functions (`convertJS`/`processBlock`/`convertTS`/`convertPython` etc.) with identical signatures — only internal typing changes.

- [ ] **Step 1: Baseline — confirm parser tests pass before touching anything**

Run: `npx jest __tests__/parser-js-accuracy.test.ts __tests__/parser-python-accuracy.test.ts __tests__/parser.test.ts __tests__/python-lines.test.ts -v`
Expected: PASS (record this as the behavior baseline — Task 4 must not change these results).

- [ ] **Step 2: Remove the file-level `eslint-disable` in `lib/parser/javascript.ts` and see what breaks**

Delete the line `/* eslint-disable @typescript-eslint/no-explicit-any */` at the top of `lib/parser/javascript.ts`.

Run: `npx eslint lib/parser/javascript.ts`
Expected: a list of `no-explicit-any` errors, one per `any` usage — this is your worklist for this file.

- [ ] **Step 3: Type the acorn AST node parameters precisely**

For each flagged line, replace `any` with the correct acorn type. Acorn's own `Node` type only guarantees `type`, `start`, `end`, `loc` — real node shapes (e.g. `IfStatement`, `ForStatement`, `CallExpression`) come from `acorn`'s `Node` union or from casting to a local narrow interface. Prefer this pattern already established in `lib/parser/types.ts` (check that file for any existing narrow AST interfaces before adding new ones):

```ts
import type { Node } from 'acorn'

interface IfStatementNode extends Node {
  type: 'IfStatement'
  test: Node
  consequent: Node
  alternate: Node | null
}
```

Add one narrow interface per distinct node shape the switch/if-chain in `processBlock` (or equivalent) actually dispatches on — do not create a generic catch-all `any` replacement; each usage should get its real shape.

- [ ] **Step 4: Run eslint again to confirm zero `no-explicit-any` violations in this file**

Run: `npx eslint lib/parser/javascript.ts`
Expected: no errors.

- [ ] **Step 5: Run parser tests to confirm no behavior changed**

Run: `npx jest __tests__/parser-js-accuracy.test.ts __tests__/parser.test.ts -v`
Expected: PASS, identical to Step 1 baseline.

- [ ] **Step 6: Repeat Steps 2-5 for `lib/parser/typescript.ts`**

Same process: remove its `eslint-disable`, add narrow types for the 5 flagged spots (this file already documents one legitimate unavoidable `any` — the `tsPlugin` CJS-interop cast explained in its existing comment; that one may stay as a targeted `as any` on that single line with the existing comment, not a file-wide disable — everything else must be typed).

Run: `npx eslint lib/parser/typescript.ts && npx jest __tests__/parser-js-accuracy.test.ts -v`
Expected: no lint errors outside the documented interop cast; tests pass.

- [ ] **Step 7: Repeat for `lib/parser/python.ts`'s 6 occurrences**

Run: `npx eslint lib/parser/python.ts && npx jest __tests__/parser-python-accuracy.test.ts __tests__/python-lines.test.ts -v`
Expected: no lint errors; tests pass.

- [ ] **Step 8: Full-repo verification**

Run:
```bash
npm run lint
npm test
npm run build
```
Expected: all green, zero `no-explicit-any` suppressions remaining outside the one documented `acorn-typescript` interop cast.

- [ ] **Step 9: Commit**

```bash
git add lib/parser/javascript.ts lib/parser/typescript.ts lib/parser/python.ts
git commit -m "refactor: replace any with precise AST types across the parser, drop file-wide any suppressions"
```

---

### Task 5: Defer Monaco and Mermaid behind `next/dynamic` with a loading state

**Files:**
- Modify: `components/editor/CodeEditor.tsx`
- Modify: `components/editor/FlowchartPanel.tsx`
- Modify: `components/share/ShareView.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: same component exports/props as today — this is purely about *when* the JS downloads/executes relative to first paint of the editor shell, not what renders.

- [ ] **Step 1: Read current CodeEditor.tsx top-of-file imports and export shape**

Run: `sed -n '1,30p' components/editor/CodeEditor.tsx`

- [ ] **Step 2: Wrap the Monaco import with `next/dynamic` and a skeleton fallback**

In `components/editor/CodeEditor.tsx`, replace the static `import MonacoEditor, { loader } from '@monaco-editor/react'` usage: keep `loader` imported statically (it's tiny, just config), but load the `<MonacoEditor>` component itself via:

```tsx
import dynamic from 'next/dynamic'
import { loader } from '@monaco-editor/react'

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading editor…</div>,
})
```

Remove the old default import of `MonacoEditor` and keep every other usage in the file unchanged (same props passed to `<MonacoEditor>`).

- [ ] **Step 3: Apply the same pattern to `components/share/ShareView.tsx`'s Monaco import**

Same transformation as Step 2, scoped to that file's own top-of-file imports.

- [ ] **Step 4: Defer the `mermaid` import in `components/editor/FlowchartPanel.tsx`**

`mermaid` is imported and used inside `useEffect`, not at module top-level render — confirm with `grep -n "mermaid" components/editor/FlowchartPanel.tsx`. If it's already only referenced inside an effect/async function (not at module scope), convert the static top-level `import mermaid from 'mermaid'` into a dynamic `const { default: mermaid } = await import('mermaid')` inside that same effect, so it's fetched only when the panel actually mounts rather than bundled into the initial chunk for that route.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, open `/editor`, confirm: the editor shell (toolbar, panel borders) paints immediately, "Loading editor…" briefly shows, then Monaco loads and is fully interactive (typing, syntax highlighting). Open `/editor/[id]` with an existing flowchart (or `/share/[shareId]`) and confirm the mermaid diagram still renders correctly with no console errors.

- [ ] **Step 6: Run full test suite and build**

Run:
```bash
npm test
npm run build
```
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add components/editor/CodeEditor.tsx components/editor/FlowchartPanel.tsx components/share/ShareView.tsx
git commit -m "perf: defer Monaco/Mermaid loading behind next/dynamic with loading states"
```

---

## Self-Review Notes

- **Spec coverage:** All 6 audit findings map 1:1 to a task (Finding 1 → Task 1, Finding 2 → Task 5, Findings 3-4 → Task 2, Finding 5 → Task 4, Finding 6 → Task 3).
- **Independence:** Tasks 1-5 touch disjoint files (only Task 1 and Task 5 both touch the `components/` tree, but different files within it) — safe to dispatch in parallel via subagent-driven-development.
- **No placeholders:** every step has literal code, exact commands, and expected output.
