# Contributing to Code2Flow

Thanks for considering a contribution — this project is early in its open-source life, and issues of any size (typos to new features) are genuinely welcome.

## Code of Conduct

Be respectful, be constructive, assume good faith. Disagree about code, not about people. That's the whole policy.

## Getting Set Up

1. Fork the repo and clone your fork.
2. Follow the [Getting Started](README.md#getting-started) section of the README to install dependencies and configure Supabase + Upstash.
3. Create a branch off `main`:

   ```bash
   git checkout -b fix/short-description
   # or: feat/short-description, docs/short-description
   ```

4. Before opening a PR, all three of these must pass locally:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

   CI runs the same three checks on every PR — a red check means the PR won't be reviewed until it's green.

## Development Conventions

- **TypeScript strict mode** is on — don't add `any` unless you're touching parser internals that already carry `/* eslint-disable @typescript-eslint/no-explicit-any */` (AST node shapes are inherently dynamic there).
- **No unnecessary comments.** Code should read clearly from naming; a comment should only exist to explain a non-obvious *why* (a workaround, an invariant, a subtle bug it's protecting against) — not to restate *what* the code does.
- **Commit messages** follow the existing convention: `fix: ...`, `feat: ...`, `refactor: ...`, `docs: ...`, `test: ...` — imperative mood, one logical change per commit.
- **Tests accompany behavior changes.** If you fix a bug in `lib/parser/`, add a case to `__tests__/parser.test.ts` that would have caught it. Regressions here are easy to miss because a broken flowchart still "renders" — it just renders *wrong* — so connectivity/shape assertions matter more than "it didn't throw."
- **Security-sensitive changes** (anything touching `middleware.ts`, `app/api/**`, RLS policies in `docs/supabase-setup.sql`, or auth flows) should explain the access-control reasoning in the PR description, not just the diff.

## What to Work On

Check [open issues](https://github.com/Emp1500/Code2Flow/issues) first. If you want to dive in without waiting for an issue to be filed, here are known gaps that are good starting points:

- **Python parser is line-based, not AST-based** (`lib/parser/python.ts`) — it mis-tokenizes multi-line statements and docstrings containing code-like text. Swapping in a real Python AST source (or hardening the tokenizer with a proper indentation-aware state machine) is a meaningful, self-contained project.
- **Test coverage is thin** relative to parser complexity — nested control flow, mixed constructs (loop containing try/except containing if/elif), and negative/malformed input are all under-tested.
- **No redundant application-level ownership checks** in `app/api/flowcharts/**` — access control is 100% delegated to Postgres RLS today (correctly enforced, but a single point of failure). Adding explicit `user_id` checks as defense-in-depth is a good scoped PR.
- **Rate limiting isn't applied uniformly** — `PATCH`/`DELETE` on `/api/flowcharts/[id]` currently have no rate limit while `POST`/`PUT` do.

If you're proposing something larger (a new supported language, a new export format, real-time collaboration, etc.), please open an issue to discuss the design before writing code — it's much easier to align on approach early than to rework a large PR after the fact.

## Reporting Bugs

Open a [GitHub issue](https://github.com/Emp1500/Code2Flow/issues/new) with:

- What you did, what you expected, what happened instead
- The code snippet that produced the wrong flowchart, if parser-related
- Browser/Node version if it looks environment-specific

## Reporting Security Issues

This project handles authentication and user data. **Please do not open a public issue for a security vulnerability.** Instead, report it privately by opening a [GitHub security advisory](https://github.com/Emp1500/Code2Flow/security/advisories/new) on this repo, or contact the maintainer directly. Give a reasonable window to fix the issue before any public disclosure.

## Pull Request Checklist

- [ ] `npm run lint`, `npm test`, and `npm run build` all pass
- [ ] New behavior has a corresponding test
- [ ] PR description explains *why*, not just *what* (link an issue if one exists)
- [ ] No unrelated changes bundled in (formatting-only diffs, unrelated refactors) — keep PRs focused and reviewable

## Questions?

Open a [discussion](https://github.com/Emp1500/Code2Flow/discussions) or an issue tagged `question`.
