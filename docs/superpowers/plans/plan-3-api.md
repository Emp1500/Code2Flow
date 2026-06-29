# Plan 3: Database, Validations & API Routes

> **Prereq:** plan-1-foundation.md + plan-2-parser.md complete.

**Goal:** Apply Supabase schema + RLS, then implement all API routes (flowcharts CRUD, share, versions).

---

## Task 7: Supabase Database Setup (Manual Step)

**File:** `docs/supabase-setup.sql` (apply in Supabase SQL Editor — not a code deploy)

- [ ] **7.1 Write `docs/supabase-setup.sql`**
```sql
-- Profiles (auto-created by trigger on signup)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Flowcharts
CREATE TABLE IF NOT EXISTS flowcharts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled' CHECK (char_length(title) <= 100),
  language      TEXT NOT NULL DEFAULT 'javascript'
                  CHECK (language IN ('javascript', 'typescript', 'python')),
  is_public     BOOLEAN NOT NULL DEFAULT false,
  share_id      TEXT UNIQUE,
  thumbnail_url TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Version history
CREATE TABLE IF NOT EXISTS flowchart_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flowchart_id   UUID NOT NULL REFERENCES flowcharts(id) ON DELETE CASCADE,
  code           TEXT NOT NULL CHECK (char_length(code) <= 50000),
  version_number INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER flowcharts_updated_at
  BEFORE UPDATE ON flowcharts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE flowcharts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE flowchart_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile"     ON profiles          USING (auth.uid() = id);
CREATE POLICY "owners_full"     ON flowcharts        USING (auth.uid() = user_id);
CREATE POLICY "public_read"     ON flowcharts        FOR SELECT USING (is_public = true);
CREATE POLICY "owner_versions"  ON flowchart_versions
  USING (flowchart_id IN (SELECT id FROM flowcharts WHERE user_id = auth.uid()));
```

- [ ] **7.2 Apply SQL in Supabase dashboard**
  - Go to your Supabase project → SQL Editor → paste & run `docs/supabase-setup.sql`
  - Verify: `flowcharts`, `flowchart_versions`, `profiles` tables appear in Table Editor

- [ ] **7.3 Commit**
```bash
git add docs/supabase-setup.sql
git commit -m "docs: add Supabase schema + RLS setup SQL"
```

---

## Task 8: Validations + Share Helper

**Files:** `lib/validations.ts`, `lib/share.ts`, `lib/rate-limit.ts`

- [ ] **8.1 Write `lib/validations.ts`**
```ts
import { z } from 'zod'

export const SaveFlowchartSchema = z.object({
  title:    z.string().min(1).max(100).trim(),
  code:     z.string().max(50_000),
  language: z.enum(['javascript', 'typescript', 'python']),
})

export const UpdateFlowchartSchema = z.object({
  title:    z.string().min(1).max(100).trim().optional(),
  code:     z.string().max(50_000).optional(),
  language: z.enum(['javascript', 'typescript', 'python']).optional(),
})

export const RenameSchema = z.object({
  title: z.string().min(1).max(100).trim(),
})

export type SaveFlowchartInput   = z.infer<typeof SaveFlowchartSchema>
export type UpdateFlowchartInput = z.infer<typeof UpdateFlowchartSchema>
```

- [ ] **8.2 Write `lib/share.ts`**
```ts
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 10)

export function generateShareId(): string {
  return nanoid()
}
```

- [ ] **8.3 Write `lib/rate-limit.ts`**
```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const saveLimit  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1m') })
export const shareLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1m') })
export const globalLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1m') })

export async function checkRateLimit(limiter: Ratelimit, key: string) {
  const { success, reset } = await limiter.limit(key)
  return { success, retryAfter: Math.ceil((reset - Date.now()) / 1000) }
}
```

- [ ] **8.4 Commit**
```bash
git add lib/validations.ts lib/share.ts lib/rate-limit.ts
git commit -m "feat: add Zod validations, share ID generator, rate limiter"
```

---

## Task 9: Flowcharts API — List + Create

**File:** `app/api/flowcharts/route.ts`

- [ ] **9.1 Write `app/api/flowcharts/route.ts`**
```ts
import { createClient }     from '@/lib/supabase/server'
import { SaveFlowchartSchema } from '@/lib/validations'
import { saveLimit, checkRateLimit } from '@/lib/rate-limit'
import { NextResponse }     from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('flowcharts')
    .select('id, title, language, is_public, share_id, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, retryAfter } = await checkRateLimit(saveLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const body   = await request.json()
  const parsed = SaveFlowchartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { title, code, language } = parsed.data

  const { data: flowchart, error } = await supabase
    .from('flowcharts')
    .insert({ user_id: user.id, title, language })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create version 1
  await supabase.from('flowchart_versions').insert({
    flowchart_id: flowchart.id, code, version_number: 1,
  })

  return NextResponse.json(flowchart, { status: 201 })
}
```

- [ ] **9.2 Commit**
```bash
git add app/api/flowcharts/route.ts
git commit -m "feat: add GET /api/flowcharts and POST /api/flowcharts"
```

---

## Task 10: Flowchart API — Get / Update / Delete

**File:** `app/api/flowcharts/[id]/route.ts`

- [ ] **10.1 Write `app/api/flowcharts/[id]/route.ts`**
```ts
import { createClient }          from '@/lib/supabase/server'
import { UpdateFlowchartSchema, RenameSchema } from '@/lib/validations'
import { saveLimit, checkRateLimit }  from '@/lib/rate-limit'
import { NextResponse }          from 'next/server'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get flowchart + latest version code
  const { data: fc, error } = await supabase
    .from('flowcharts').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: version } = await supabase
    .from('flowchart_versions')
    .select('code, version_number')
    .eq('flowchart_id', params.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ ...fc, code: version?.code ?? '', version_number: version?.version_number ?? 0 })
}

export async function PUT(request: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, retryAfter } = await checkRateLimit(saveLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const body   = await request.json()
  const parsed = UpdateFlowchartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { code, ...meta } = parsed.data

  if (Object.keys(meta).length) {
    await supabase.from('flowcharts').update(meta).eq('id', params.id)
  }

  if (code !== undefined) {
    // Get next version number
    const { data: latest } = await supabase
      .from('flowchart_versions')
      .select('version_number')
      .eq('flowchart_id', params.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (latest?.version_number ?? 0) + 1

    await supabase.from('flowchart_versions').insert({
      flowchart_id: params.id, code, version_number: nextVersion,
    })

    // Prune to 50 versions
    const { data: all } = await supabase
      .from('flowchart_versions')
      .select('id, version_number')
      .eq('flowchart_id', params.id)
      .order('version_number', { ascending: true })

    if (all && all.length > 50) {
      const toDelete = all.slice(0, all.length - 50).map(v => v.id)
      await supabase.from('flowchart_versions').delete().in('id', toDelete)
    }
  }

  const { data: updated } = await supabase.from('flowcharts').select('*').eq('id', params.id).single()
  return NextResponse.json(updated)
}

export async function PATCH(request: Request, { params }: Params) {
  // Rename only — no new version created
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = RenameSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('flowcharts').update({ title: parsed.data.title }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('flowcharts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **10.2 Commit**
```bash
git add app/api/flowcharts/
git commit -m "feat: add flowchart GET/PUT/PATCH/DELETE API routes"
```

---

## Task 11: Share + Versions API Routes

**Files:** `app/api/flowcharts/[id]/share/route.ts`, `app/api/flowcharts/[id]/versions/route.ts`

- [ ] **11.1 Write `app/api/flowcharts/[id]/share/route.ts`**
```ts
import { createClient }    from '@/lib/supabase/server'
import { generateShareId } from '@/lib/share'
import { shareLimit, checkRateLimit } from '@/lib/rate-limit'
import { NextResponse }    from 'next/server'

type Params = { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, retryAfter } = await checkRateLimit(shareLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const { data: fc } = await supabase.from('flowcharts').select('is_public, share_id').eq('id', params.id).single()
  if (!fc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const toggled    = !fc.is_public
  const share_id   = toggled && !fc.share_id ? generateShareId() : fc.share_id
  const updateData = toggled ? { is_public: true, share_id } : { is_public: false }

  const { data: updated } = await supabase
    .from('flowcharts').update(updateData).eq('id', params.id).select('is_public, share_id').single()

  return NextResponse.json(updated)
}
```

- [ ] **11.2 Write `app/api/flowcharts/[id]/versions/route.ts`**
```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

type Params = { params: { id: string } }

// GET /api/flowcharts/[id]/versions        → list (no code, metadata only)
// GET /api/flowcharts/[id]/versions?v=12   → single version with code
export async function GET(request: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const vParam = searchParams.get('v')

  if (vParam) {
    const { data, error } = await supabase
      .from('flowchart_versions')
      .select('id, code, version_number, created_at')
      .eq('flowchart_id', params.id)
      .eq('version_number', Number(vParam))
      .single()
    if (error) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('flowchart_versions')
    .select('id, version_number, created_at')
    .eq('flowchart_id', params.id)
    .order('version_number', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **11.3 Commit**
```bash
git add app/api/flowcharts/
git commit -m "feat: add share toggle and version history API routes"
```

---

## Verification

```bash
npm run build
# Expected: build succeeds, no TypeScript errors
```

Manually test with curl (replace TOKEN with a valid Supabase JWT from browser localStorage):
```bash
curl http://localhost:3000/api/flowcharts \
  -H "Cookie: sb-access-token=TOKEN"
# Expected: [] (empty list for new user)
```

**Plan 3 complete. Proceed to `plan-4-editor.md`.**
