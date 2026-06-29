# Plan 1: Foundation — Next.js Bootstrap + Auth

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Replace Express app with Next.js 14, install all deps, wire Supabase auth (login/register/middleware).

**Spec:** `docs/superpowers/specs/2026-06-25-code2flow-fullstack-redesign.md`

**Next plans:** plan-2-parser.md → plan-3-api.md → plan-4-editor.md → plan-5-features.md

---

## Task 1: Bootstrap Next.js 14

**Files:** `package.json`, `next.config.js`, `.env.local.example`, `tsconfig.json`, `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`

- [ ] **1.1 Remove old files**
```bash
rm -f server.js public/index.html public/app.js
rm -rf src node_modules package-lock.json
```

- [ ] **1.2 Init Next.js in place**
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
# Answer prompts: use defaults (Yes to all)
```

- [ ] **1.3 Install project dependencies**
```bash
npm install @supabase/ssr @supabase/supabase-js @upstash/redis @upstash/ratelimit \
  @monaco-editor/react mermaid html-to-image nanoid zod \
  cmdk react-resizable-panels \
  class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **1.4 Install shadcn/ui**
```bash
npx shadcn@latest init
# Style: Default, Base color: Slate, CSS variables: Yes
npx shadcn@latest add button input label toast dialog drawer badge separator
```

- [ ] **1.5 Write `next.config.js`**
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io",
            "worker-src blob:",
          ].join('; '),
        },
      ],
    }]
  },
}
module.exports = nextConfig
```

- [ ] **1.6 Write `.env.local.example`**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```
```bash
cp .env.local.example .env.local
# Fill in real values before running dev
```

- [ ] **1.7 Verify build compiles**
```bash
npm run build
# Expected: compiled successfully (with no pages yet, expect 0 errors)
```

- [ ] **1.8 Commit**
```bash
git add -A
git commit -m "feat: bootstrap Next.js 14 with all dependencies"
```

---

## Task 2: Types + Supabase Clients

**Files:** `types/index.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/utils.ts`

- [ ] **2.1 Write `types/index.ts`**
```ts
export type Language = 'javascript' | 'typescript' | 'python'

export interface Profile {
  id: string
  username: string
  created_at: string
}

export interface Flowchart {
  id: string
  user_id: string
  title: string
  language: Language
  is_public: boolean
  share_id: string | null
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

export interface FlowchartVersion {
  id: string
  flowchart_id: string
  code: string
  version_number: number
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      flowcharts: {
        Row: Flowchart
        Insert: Omit<Flowchart, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Flowchart, 'id' | 'user_id' | 'created_at'>>
      }
      flowchart_versions: {
        Row: FlowchartVersion
        Insert: Omit<FlowchartVersion, 'id' | 'created_at'> & { id?: string }
        Update: never
      }
    }
  }
}
```

- [ ] **2.2 Write `lib/supabase/client.ts`**
```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **2.3 Write `lib/supabase/server.ts`**
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **2.4 Write `lib/utils.ts`**
```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **2.5 Commit**
```bash
git add types/ lib/
git commit -m "feat: add database types and Supabase client helpers"
```

---

## Task 3: Middleware + Auth Pages

**Files:** `middleware.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/api/auth/callback/route.ts`

- [ ] **3.1 Write `middleware.ts`**
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isProtected = path.startsWith('/dashboard') || path.startsWith('/editor')
  const isAuthPage = path === '/login' || path === '/register'

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|share).*)'],
}
```

- [ ] **3.2 Write `app/api/auth/callback/route.ts`**
```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

- [ ] **3.3 Write `app/(auth)/login/page.tsx`**
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg">
        <h1 className="text-2xl font-semibold text-center">Sign in to Code2Flow</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          No account?{' '}
          <Link href="/register" className="underline">Create one</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **3.4 Write `app/(auth)/register/page.tsx`**
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg">
        <h1 className="text-2xl font-semibold text-center">Create your account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username}
              onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **3.5 Write `app/layout.tsx`**
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Code2Flow',
  description: 'Visualize code as flowcharts',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **3.6 Verify auth routes compile**
```bash
npm run build
# Expected: no TypeScript errors
```

- [ ] **3.7 Commit**
```bash
git add app/ middleware.ts lib/
git commit -m "feat: add auth pages, middleware, Supabase callback route"
```

---

## Verification

```bash
npm run dev
# Visit http://localhost:3000/login → shows login form
# Visit http://localhost:3000/dashboard → redirects to /login (middleware working)
# Visit http://localhost:3000/register → shows register form
```

**Plan 1 complete. Proceed to `plan-2-parser.md`.**
