import Link from 'next/link'
import { Zap, Clock, Share2, ArrowRight, MoveDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { DottedSurface } from '@/components/ui/DottedSurface'

const features = [
  {
    icon: Zap,
    title: 'Instant preview',
    desc: 'Flowchart updates as you type with 250ms debounce.',
  },
  {
    icon: Clock,
    title: 'Version history',
    desc: 'Every save creates a version. Restore any previous state.',
  },
  {
    icon: Share2,
    title: 'Public sharing',
    desc: 'Toggle a link to share read-only views with anyone.',
  },
]

const sampleCode = [
  { code: 'function checkAccess(user) {', indent: 0 },
  { code: 'if (!user.isActive) {', indent: 1 },
  { code: 'return deny()', indent: 2 },
  { code: '}', indent: 1 },
  { code: 'return grant(user)', indent: 1 },
  { code: '}', indent: 0 },
]

export default async function LandingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <DottedSurface />
      <Navbar user={user} />
      <main className="relative max-w-5xl mx-auto px-4 pt-20 pb-16 sm:pt-28 text-center">
        <p className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground border border-border rounded-full px-3 py-1 mb-6 bg-card/60">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
          JavaScript · TypeScript · Python
        </p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter mb-6 text-balance">
          Turn code into flowcharts —{' '}
          <span className="text-primary">instantly</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-xl mx-auto text-pretty">
          Paste JavaScript, TypeScript, or Python. Code2Flow generates a live flowchart as you type.
          Save, share, and version your diagrams.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link href={user ? '/editor' : '/register'}>
            <Button size="lg" className="gap-2 px-5">
              Start for free
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          {user && (
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="px-5">My flowcharts</Button>
            </Link>
          )}
        </div>

        {/* Code → flowchart illustration */}
        <div className="mt-16 sm:mt-20 grid md:grid-cols-[1fr_auto_1fr] items-center gap-6 max-w-3xl mx-auto">
          <div className="text-left rounded-lg border border-border bg-card shadow-xl overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border bg-muted/50">
              <span className="size-2.5 rounded-full bg-destructive/60" aria-hidden />
              <span className="size-2.5 rounded-full bg-amber-500/60" aria-hidden />
              <span className="size-2.5 rounded-full bg-primary/60" aria-hidden />
              <span className="ml-2 font-mono text-xs text-muted-foreground">access.js</span>
            </div>
            <pre className="p-4 font-mono text-xs sm:text-sm text-muted-foreground leading-6 overflow-x-auto">
              {sampleCode.map((l, i) => (
                <div key={i}>
                  <span className="select-none text-muted-foreground/40 mr-4">{i + 1}</span>
                  <span style={{ paddingLeft: `${l.indent}rem` }} className="inline-block">
                    {l.code}
                  </span>
                </div>
              ))}
            </pre>
          </div>
          <div className="justify-self-center text-primary" aria-hidden>
            <ArrowRight className="size-6 hidden md:block" />
            <MoveDown className="size-6 md:hidden" />
          </div>
          <div className="flex flex-col items-center gap-1.5 font-mono text-xs" aria-hidden>
            <div className="px-4 py-2 rounded-full border border-border bg-card">checkAccess(user)</div>
            <div className="w-px h-3 bg-border" />
            <div className="px-4 py-2 rounded-md border border-primary/50 bg-primary/10 text-primary">
              !user.isActive?
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-muted-foreground">yes</span>
                <div className="px-3 py-2 rounded-md border border-destructive/40 bg-destructive/10">deny()</div>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-muted-foreground">no</span>
                <div className="px-3 py-2 rounded-md border border-border bg-card">grant(user)</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left">
          {features.map(f => (
            <div
              key={f.title}
              className="p-6 bg-card/70 hover:bg-card transition-colors duration-200 ring-1 ring-border/60 hover:ring-border rounded-lg"
            >
              <div className="inline-flex items-center justify-center size-9 rounded-md bg-primary/10 text-primary mb-4">
                <f.icon className="size-4" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="relative border-t border-border/60 py-8 text-center">
        <p className="font-mono text-xs text-muted-foreground">
          Code2Flow — visualize code as flowcharts
        </p>
      </footer>
    </div>
  )
}
