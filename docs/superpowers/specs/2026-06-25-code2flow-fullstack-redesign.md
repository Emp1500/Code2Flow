# Code2Flow — Full-Stack Redesign Spec

**Date:** 2026-06-25
**Status:** Approved

---

## 1. Overview

Migrate Code2Flow from a vanilla JS + Express app to a production-grade full-stack Next.js application deployable on Vercel. The goal is a resume-quality project targeting General SWE and Full-Stack engineering roles, demonstrating authentication, database design, security, sharing, version history, and professional UX patterns.

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 App Router + TypeScript | Vercel-native, industry standard |
| Styling | TailwindCSS + shadcn/ui | Professional UI fast, widely used |
| Code Editor | `@monaco-editor/react` | Same as VS Code |
| Flowchart Rendering | Mermaid.js | Existing, battle-tested |
| PNG Export | `html-to-image` | Client-side, no storage needed |
| Auth + Database | Supabase (Auth + PostgreSQL) | Free tier, covers all needs |
| Rate Limiting | Upstash Redis | Free tier (10k cmd/day) |
| Share IDs | `nanoid` | Cryptographically random, URL-safe |
| Validation | Zod | Type-safe API input validation |
| Command Palette | `cmdk` | VS Code-style Ctrl+K |
| Resizable Panels | `react-resizable-panels` | Professional editor UX |
| Deployment | Vercel (Hobby — free) | Zero-config with Next.js |

**All services used are on free tiers.** No paid subscriptions required.

> Note: Supabase free projects pause after 1 week of inactivity. Keep alive with a weekly login or a simple cron ping.

---

## 3. Pages & Routes

| Route | Auth | Purpose |
|---|---|---|
| `/` | Public | Landing page — hero, features, CTA |
| `/login` | Public | Email/password login |
| `/register` | Public | Sign up |
| `/dashboard` | Protected | Grid of user's saved flowcharts |
| `/editor` | Protected | New blank flowchart |
| `/editor/[id]` | Protected | Edit a saved flowchart |
| `/share/[shareId]` | Public | Read-only view, no login required |

Route protection is enforced at two levels:
1. **`middleware.ts`** — redirects unauthenticated users away from `/dashboard` and `/editor/*`
2. **`(protected)/layout.tsx`** — server-side session re-check as a second guard

`/share/[shareId]` bypasses middleware entirely — access control is handled purely by Supabase RLS.

---

## 4. Database Schema

```sql
-- Profiles: auto-created on signup via Supabase DB trigger
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Flowcharts
CREATE TABLE flowcharts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled'
                  CHECK (char_length(title) <= 100),
  language      TEXT NOT NULL DEFAULT 'javascript'
                  CHECK (language IN ('javascript', 'typescript', 'python')),
  is_public     BOOLEAN NOT NULL DEFAULT false,
  share_id      TEXT UNIQUE,   -- nanoid(10), set when is_public flipped to true
  thumbnail_url TEXT,          -- reserved for future use; currently unused
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Version history
CREATE TABLE flowchart_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flowchart_id   UUID NOT NULL REFERENCES flowcharts(id) ON DELETE CASCADE,
  code           TEXT NOT NULL CHECK (char_length(code) <= 50000),
  version_number INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS)

RLS is the critical security layer — enforced at the database, not just the API.

```sql
-- Flowcharts
ALTER TABLE flowcharts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_full_access" ON flowcharts
  USING (auth.uid() = user_id);

CREATE POLICY "public_read" ON flowcharts
  FOR SELECT USING (is_public = true);

-- Versions: only flowchart owner can access
ALTER TABLE flowchart_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only" ON flowchart_versions
  USING (
    flowchart_id IN (
      SELECT id FROM flowcharts WHERE user_id = auth.uid()
    )
  );
```

Even if an attacker bypasses the API and hits Supabase directly with a stolen anon key, RLS prevents them from reading another user's private data.

---

## 5. Security Architecture

### Input Validation (Zod)
Every API route validates its request body against a Zod schema before touching the database. Malformed or oversized requests are rejected with a 400.

```ts
const SaveFlowchartSchema = z.object({
  title:    z.string().min(1).max(100).trim(),
  code:     z.string().max(50_000),
  language: z.enum(['javascript', 'typescript', 'python']),
})
```

### Security Headers (`next.config.js`)
Applied globally to every response:
- `Content-Security-Policy` — blocks injected scripts (XSS)
- `X-Frame-Options: DENY` — blocks clickjacking
- `X-Content-Type-Options: nosniff` — stops MIME-type sniffing
- `Strict-Transport-Security` — enforces HTTPS
- `Referrer-Policy: strict-origin` — limits referrer leakage
- `Permissions-Policy` — disables camera, microphone, geolocation

### Rate Limiting (Upstash Redis)

| Endpoint | Limit |
|---|---|
| `POST /api/flowcharts` | 30 req / min per user |
| `PUT /api/flowcharts/[id]` | 30 req / min per user |
| `POST /api/flowcharts/[id]/share` | 10 req / min per user |
| Auth endpoints | 5 req / min per IP |
| Global fallback | 100 req / min per IP |

Returns `429 Too Many Requests` with a `Retry-After` header.

### Auth Security
- Sessions stored in **HTTP-only cookies** — inaccessible to JavaScript, defeating XSS token theft
- Supabase rotates JWTs automatically
- Every protected API route re-validates the session server-side — never trusts client-sent data
- Supabase **service role key** lives only in server-side env vars, never exposed to the browser (`NEXT_PUBLIC_` prefix never used for secrets)

### Share ID Security
- Generated with `nanoid(10)` — 62^10 ≈ 839 trillion combinations
- No sequential IDs — cannot enumerate flowcharts
- Generated server-side only
- `share_id` persists when toggling private (same URL re-activates on re-share; no new ID generated)

### What This Prevents
| Attack | Defense |
|---|---|
| SQL injection | Supabase parameterized queries + RLS |
| XSS | CSP headers + no raw HTML from user input |
| CSRF | SameSite cookies + Next.js server actions |
| Data enumeration | Random share IDs + RLS |
| Brute-force login | Rate limiting on auth routes |
| Clickjacking | X-Frame-Options header |
| Privilege escalation | RLS enforced at DB level |
| Token theft via XSS | HTTP-only cookies |

---

## 6. File Structure

```
code2flow/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (protected)/
│   │   ├── layout.tsx                   # Auth guard
│   │   ├── dashboard/page.tsx
│   │   └── editor/
│   │       ├── page.tsx                 # New flowchart
│   │       └── [id]/page.tsx            # Edit existing
│   ├── share/
│   │   └── [shareId]/page.tsx           # Public read-only
│   ├── api/
│   │   ├── flowcharts/
│   │   │   ├── route.ts                 # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts             # GET, PUT, DELETE
│   │   │       ├── share/route.ts       # POST toggle public
│   │   │       └── versions/route.ts    # GET list, POST restore
│   │   └── auth/callback/route.ts
│   ├── page.tsx                         # Landing page
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── ui/                              # shadcn/ui components
│   ├── editor/
│   │   ├── EditorLayout.tsx             # react-resizable-panels
│   │   ├── CodeEditor.tsx               # Monaco wrapper
│   │   ├── FlowchartPanel.tsx           # Mermaid renderer
│   │   ├── EditorToolbar.tsx            # Save, share, download, language
│   │   └── VersionDrawer.tsx            # Version list + restore
│   ├── dashboard/
│   │   ├── FlowchartCard.tsx            # Mini Mermaid preview + actions
│   │   └── FlowchartGrid.tsx
│   ├── share/
│   │   └── ShareView.tsx                # Read-only editor + flowchart
│   ├── command/
│   │   └── CommandPalette.tsx           # Ctrl+K (cmdk)
│   └── layout/
│       ├── Navbar.tsx
│       └── Footer.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # Browser singleton
│   │   └── server.ts                    # Server client (cookies)
│   ├── parser/
│   │   ├── types.ts                     # FlowchartNode, Edge, Graph, Context
│   │   ├── javascript.ts                # Acorn JS parser (migrated)
│   │   ├── typescript.ts                # TS (Acorn ecmaVersion 2020)
│   │   ├── python.ts                    # Custom tokenizer (migrated)
│   │   └── converter.ts                 # Graph → Mermaid string
│   ├── validations.ts                   # Zod schemas
│   ├── rate-limit.ts                    # Upstash config
│   ├── share.ts                         # nanoid(10) generator
│   └── utils.ts
│
├── types/index.ts
├── middleware.ts                        # Route protection + rate limit
└── next.config.js                       # Security headers
```

---

## 7. Key Data Flows

### Save Flowchart
```
Ctrl+S / Save button
→ POST /api/flowcharts or PUT /api/flowcharts/[id]
→ middleware: verify session cookie
→ rate-limit: check Upstash → 429 if exceeded
→ Zod: validate body → 400 if invalid
→ Supabase insert/update (RLS enforces user_id match)
→ Insert flowchart_versions row (version_number = max + 1)
→ If versions > 50: delete oldest
→ Toast: "Saved"
```

### Toggle Public Sharing
```
Share toggle clicked
→ POST /api/flowcharts/[id]/share
→ Auth + rate limit (10/min)
→ If making public and share_id is null: generate nanoid(10)
→ Set is_public = true, store share_id
→ If making private: set is_public = false (share_id preserved)
→ Return /share/{share_id}
→ Copy to clipboard + Toast: "Link copied"
```

### View Shared Flowchart
```
Anyone visits /share/abc123
→ Server Component: SELECT WHERE share_id = 'abc123'
→ RLS: SELECT allowed only if is_public = true
→ Not found or private → 404
→ ShareView: read-only Monaco + Mermaid
→ "Download PNG" available to all
→ "Fork to my account" shown if user is logged in
```

### Restore Version
```
VersionDrawer: GET /api/flowcharts/[id]/versions (metadata only)
→ User selects version → GET ?v=12 → code loads into editor
→ Editor shows "Unsaved changes"
→ User saves → creates new version (old versions preserved)
```

### Download PNG
```
Ctrl+D / Download button
→ Entirely client-side (no API call, no storage)
→ html-to-image captures flowchart panel DOM node
→ Browser downloads: {title}-flowchart.png
```

---

## 8. Command Palette (Ctrl+K)

| Command | Action |
|---|---|
| Save | POST current flowchart |
| Download PNG | html-to-image capture |
| Share / Unshare | Toggle is_public |
| Copy share link | Clipboard write |
| Language → JavaScript | Switch parser + Monaco |
| Language → TypeScript | Switch parser + Monaco |
| Language → Python | Switch parser + Monaco |
| View version history | Open VersionDrawer |
| New flowchart | Navigate /editor |
| Dashboard | Navigate /dashboard |
| Logout | supabase.auth.signOut() |

---

## 9. Supported Languages & Parsers

| Language | Parser | Notes |
|---|---|---|
| JavaScript | Acorn.js AST (migrated to TS) | Existing logic, cleaned up |
| TypeScript | Acorn.js (ecmaVersion 2020) | Superset of JS, minimal delta |
| Python | Custom line tokenizer (migrated to TS) | Existing logic, cleaned up |

Parser logic lives in `lib/parser/` as pure functions with no DOM dependency — testable in isolation, reusable as an API endpoint in the future.

---

## 10. Deployment Checklist

- [ ] Supabase project created, tables + RLS policies applied
- [ ] Supabase trigger: auto-create profile on auth.users insert
- [ ] Environment variables set in Vercel dashboard:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- [ ] `next.config.js` security headers verified
- [ ] Vercel deployment connected to GitHub repo
- [ ] Custom domain (optional)
