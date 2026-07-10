<div align="center">

# Code2Flow

**Turn code into flowcharts, in real time.**

Paste JavaScript, TypeScript, or Python — get a live, readable flowchart back. Save it, share it with a link, roll back to any past version, or export it as a PNG.

[![CI](https://github.com/Emp1500/Code2Flow/actions/workflows/ci.yml/badge.svg)](https://github.com/Emp1500/Code2Flow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3ECF8E?logo=supabase)](https://supabase.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Live Demo](https://code2flow-one.vercel.app/) · [Getting Started](#getting-started) · [Features](#features) · [Architecture](#architecture) · [Contributing](CONTRIBUTING.md)

</div>

---

> **Try it live:** [code2flow-one.vercel.app](https://code2flow-one.vercel.app/) — log in with `demo123@gmail.com` / `123456` (a shared demo account, no signup needed). Real account signup is currently unreliable due to a Supabase email-rate-limit issue we're tracking; the demo login sidesteps it entirely.

> **Screenshots / demo GIF:** coming soon. If you'd like to contribute one, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Overview

Code2Flow is a full-stack Next.js application that parses source code into an actual control-flow graph — not a generic diagram, a structural understanding of branches, loops, and early returns — and renders it live as you type. It started as a static HTML/Express tool and has been rebuilt into a production-shaped app with authentication, a persistent dashboard, public sharing, and full version history, intended as both a genuinely useful tool and a reference for how to build a small SaaS-shaped product correctly (auth, RLS, rate limiting, input validation, security headers).

## Features

- **Live parsing, three languages** — JavaScript and TypeScript via a real AST parser (Acorn + `acorn-typescript`), Python via a dedicated line-based parser. The flowchart updates as you type (debounced).
- **Accurate control flow** — correctly renders `if`/`elif`/`else` chains, loops (`for`/`while`/`do-while`/`for-in`/`for-of`), `switch`/`match`, `try`/`except`/`finally`, and early exits (`return`/`break`/`continue`/`raise`) without leaving dangling or disconnected nodes.
- **Accounts & persistence** — email/password auth via Supabase, a dashboard of your saved flowcharts, autosave, and rename/duplicate/delete.
- **Version history** — every save creates a new version (last 50 kept); restore any previous version without losing your current one.
- **Public sharing** — toggle a flowchart public to get an unguessable, read-only share link (`nanoid`-generated, not enumerable); visitors can view and fork it to their own account without needing edit access.
- **PNG export** — download the rendered flowchart as an image, entirely client-side.
- **Command palette** — `Ctrl+K` for every action (save, share, rename, language switch, navigate) without leaving the keyboard.
- **Security by default** — Postgres Row Level Security as the real access-control boundary (not just API checks), Zod validation on every request body, per-user/per-IP rate limiting, and a full set of security headers (CSP, HSTS, X-Frame-Options, etc.).

## Architecture

```
Browser (Monaco editor + Mermaid.js render)
        │  debounced keystrokes
        ▼
lib/parser/*  ── pure functions, no DOM dependency
  javascript.ts / typescript.ts → Acorn AST → graph
  python.ts                     → line tokenizer → graph
  converter.ts                  → graph → Mermaid syntax
        │
        ▼
Next.js App Router (Server Components + Route Handlers)
        │
        ├── middleware.ts ──── session refresh + route protection
        ├── app/api/**/route.ts ── Zod validation → rate limit → Supabase
        └── app/(protected)/** ── server-side auth re-check (defense in depth)
        │
        ▼
Supabase (Postgres + Auth)
  Row Level Security enforces per-user ownership at the DB layer —
  even a leaked anon key can't read another user's private data.
```

The parser is deliberately isolated from the UI: it's pure TypeScript with no DOM dependency, so it's unit-testable in isolation and could be lifted into a standalone API or CLI later.

### Security model

| Layer | Mechanism |
|---|---|
| Authorization | Postgres RLS — every table policy keys off `auth.uid()`, not application code, so the API is a convenience layer, not the security boundary |
| Input validation | Every API route validates its body with a Zod schema before it touches the database |
| Rate limiting | Upstash Redis, sliding window, per-user on writes / per-IP on auth |
| Session handling | HTTP-only cookies via `@supabase/ssr` — tokens are never reachable from JavaScript |
| Sharing | Share IDs are `nanoid(10)` (~840 trillion combinations) — not sequential, not enumerable |
| Transport | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy on every response (`next.config.js`) |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org) (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS + [shadcn/ui](https://ui.shadcn.com) |
| Code editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`) |
| Flowchart rendering | [Mermaid.js](https://mermaid.js.org) |
| Auth + database | [Supabase](https://supabase.com) (Auth + Postgres + RLS) |
| Rate limiting | [Upstash Redis](https://upstash.com) |
| Validation | [Zod](https://zod.dev) |
| Testing | Jest + ts-jest |
| Deployment target | [Vercel](https://vercel.com) |

Every service above has a free tier that comfortably covers this project — no paid subscriptions required to run your own instance.

## Getting Started

### Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) project
- A free [Upstash Redis](https://upstash.com) database

### 1. Clone and install

```bash
git clone https://github.com/Emp1500/Code2Flow.git
cd Code2Flow
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`docs/supabase-setup.sql`](docs/supabase-setup.sql) — it creates the schema (`profiles`, `flowcharts`, `flowchart_versions`), triggers, and every RLS policy the app relies on.
3. Grab your project URL and anon key from **Project Settings → API**.

### 3. Set up Upstash

Create a free Redis database at [upstash.com](https://upstash.com) and grab the REST URL and token.

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build   # production build
npm run lint    # ESLint
npm test        # Jest
```

## Project Structure

```
app/
├── (auth)/            login, register
├── (protected)/       dashboard, editor — server-side auth guard
├── share/[shareId]/   public read-only view
└── api/               route handlers (Zod → rate limit → Supabase)
components/            UI components (shadcn/ui + feature components)
lib/
├── parser/            language parsers — pure, DOM-free, unit-tested
├── supabase/           browser/server Supabase client factories
├── rate-limit.ts       Upstash config
└── validations.ts      Zod schemas
docs/
├── supabase-setup.sql  schema + RLS — run this in the Supabase SQL editor
└── superpowers/         design spec and implementation plans for the rewrite
```

## Known Limitations

Being upfront about the current gaps, partly as an invitation to contribute:

- The Python parser is a line-based tokenizer, not a full AST parser — it doesn't handle multi-line statements or docstrings containing code-like text correctly.
- Test coverage is currently thin relative to the parser's complexity (see `__tests__/`).
- Authorization currently relies entirely on Postgres RLS with no redundant application-level ownership checks — correct today, but a single point of failure if a future change ever routes a request through the (currently unused) service-role client.
- Real account signup is unreliable: the Supabase project's default email sender caps at 2 confirmation emails/hour, which real signup traffic exhausts quickly. Fixing this needs either a paid Supabase plan (to raise the limit) or a custom SMTP provider configured in the Supabase dashboard — neither is done yet. Use the shared demo login above, or run `npm run seed:demo-user` locally to create a test account that bypasses this entirely.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, coding conventions, and a list of good starting issues.

## License

[MIT](LICENSE) © Vedant Wagh

## Acknowledgments

Built on [Next.js](https://nextjs.org), [Supabase](https://supabase.com), [Monaco Editor](https://microsoft.github.io/monaco-editor/), [Mermaid.js](https://mermaid.js.org), and [Acorn](https://github.com/acornjs/acorn).
