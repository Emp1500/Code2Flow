# Parser Accuracy Fixes — Design

**Date:** 2026-07-10
**Scope:** `lib/parser/` (javascript.ts, python.ts, types.ts). No UI, API, or converter changes expected (converter.ts only if a fix needs a new edge label).
**Goal:** Fix 10 confirmed conversion-accuracy defects found by empirical audit, keeping the existing architecture: language parser → `FlowchartGraph` → Mermaid.

## Confirmed defects

| # | Lang | Defect |
|---|------|--------|
| 1 | JS/TS | Arrow-function / function-expression bodies render as one opaque box |
| 2 | JS/TS | Classes render as a single node labeled "ClassDeclaration" |
| 3 | JS/TS | `switch` without `default` has no "no match" exit edge — flow dead-ends |
| 4 | JS/TS | Labeled statements render as one node "Labeled"; `break label` targets wrong loop |
| 5 | JS/TS + Py | `throw`/`raise` inside `try` doesn't route to the handler (dead-end node) |
| 6 | Py | Single-line suites (`if x: f()`) silently drop the body |
| 7 | Py | Statements continued across physical lines shatter into one box per line |
| 8 | Py | `try/except/else` — the `else` block vanishes |
| 9 | Py | `while ... else` — the `else` body vanishes (`for ... else` already works) |
| 10 | Py | `async def` / `async for` / `async with` not recognized; bodies flatten |

## Design per fix

### JavaScript / TypeScript (`javascript.ts`)

**1. Function-valued expressions.** Extract a shared helper `processFunctionBody(label, bodyStatements, ctx)` from `processFunction` (creates subroutine + end node, sets `returnTarget`, walks body). Use it from:
- `FunctionDeclaration` (as today),
- `VariableDeclaration` declarators whose init is `ArrowFunctionExpression`/`FunctionExpression` with a **block body** — label `const add = (a, b) =>` / `function name(a, b)`; declarators are processed individually so mixed declarations still work,
- `ExpressionStatement` assignments whose RHS is such a function (`obj.fn = function () {…}`).

Expression-bodied arrows (`x => x * 2`) stay a single process node — no internal control flow to draw.

**2. Classes.** Mirror Python's `processClass`: `ClassDeclaration`/`ClassExpression` renders a subroutine node `class Name` (with ` extends Base` when present), then each `MethodDefinition` body via `processFunctionBody` with label `name(params)` (`constructor(...)`, `get x()`, `static f()` prefixes preserved). Class fields render as one process node each; fields with function values go through fix 1's path.

**3. Switch no-match edge.** In `processSwitch`, track whether a `default` case exists. If not, connect the switch decision → `after` merge with label `no match`.

**4. Labeled statements.** Add `labeledTargets: Record<string, { break: FlowchartNode | null; continue: FlowchartNode | null }>` to `TraversalContext` (copied by spread in `clone()`), plus a transient `pendingLabel: string | null`. `LabeledStatement` sets `pendingLabel = label` and processes its body. Each loop processor (and `processSwitch`) registers its targets under `pendingLabel` (then clears it) before walking the body. `processBreak`/`processContinue` with a label resolve via `labeledTargets`, falling back to the unlabeled target.

**5. Throw routing.** Add `throwTarget: FlowchartNode | null` to `TraversalContext`. `processTry` creates the catch node **before** walking the try body and sets `throwTarget` to it (or to the `finally` node when there is no handler) for the try-body context only. `processThrow` connects to `throwTarget` when set; with no enclosing try it stays a terminal node (uncaught throw = flow stops), unchanged from today. Python `processRaise` gets the identical treatment with `throwTarget` = first `except` handler node.

### Python (`python.ts`)

**7. Logical-line joining (done first — fixes 6 depends on its scanner).** New preprocessing step in `parsePython`: merge physical lines into logical lines before parsing. A small character scanner tracks bracket depth (`()[]{}`), string state (single/double quotes with escape handling, and triple-quoted strings), and trailing-backslash continuation. Lines are joined with a single space; indentation comes from the first physical line. `#` comments are stripped only when outside a string.

**6. Single-line suites.** Compound headers (`if/elif/else/for/while/def/try/except/finally/with/class/match/case`) currently require the line to end with `:`. Using the same scanner, find the **top-level** colon that terminates the header. If non-comment text follows it (`if x > 0: print("hi")`), split the remainder on top-level `;`, parse each piece via `parseLine`, and attach them as the node's `body` (no stack push — the suite is complete inline).

**8. try/except/else + misattachment.** Replace the "reverse-find an If/For/While" attachment logic for `Elif`/`Else` with: look at the **last** statement of the parent body and attach based on its type — `If` → `_elseNode` (via `getLastIf` tail), `For`/`While` → `orelse`, `Try` → new `elsebody` field. This both supports `try/else` and prevents an `else` from ever attaching to an earlier, unrelated `if`. Rendering: in `processTry`, the else block runs after the try body succeeds — `tryBody.exit → elseBlock → (finally ?? after)`; the handlers still connect straight to `(finally ?? after)`.

**9. while-else.** `processWhile` handles `node.orelse` exactly as `processFor` already does: `cond —No→ elseBody → after`.

**10. async.** In `parseLine`, if the trimmed line starts with `async `, strip the prefix, parse the remainder normally, and prepend `async ` to the rendered label for `def`/`for`/`with`.

## Error handling

No change to the public contract: `codeToMermaid(code, language)` still throws `Error` with a line number on unparseable JS/TS and never throws for Python (best-effort line parsing). The Python scanner must be total — unclosed brackets/strings at EOF flush the pending logical line as-is rather than erroring.

## Testing

Extend `__tests__/parser.test.ts` with one focused test per defect (10+), asserting on graph/Mermaid structure (e.g. "the arrow-function body's `if` produces a decision node", "switch decision has an edge to the merge when no default"). Existing tests must keep passing. Each fix is implemented test-first.

## Out of scope

Decorators, walrus operator, comprehension internals, Python `match` guard patterns, JS generators (`yield` control flow), replacing the Python line parser with a real AST parser, and any layout/rendering changes.
