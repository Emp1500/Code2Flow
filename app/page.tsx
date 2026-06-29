import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'

export default async function LandingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Turn code into flowcharts — instantly
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Paste JavaScript, TypeScript, or Python. Code2Flow generates a live flowchart as you type.
          Save, share, and version your diagrams.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href={user ? '/editor' : '/register'}>
            <Button size="lg">Start for free</Button>
          </Link>
          {user && (
            <Link href="/dashboard">
              <Button variant="outline" size="lg">My flowcharts</Button>
            </Link>
          )}
        </div>
        <div className="mt-20 grid grid-cols-3 gap-8 text-left">
          {[
            { title: 'Instant preview', desc: 'Flowchart updates as you type with 250ms debounce.' },
            { title: 'Version history', desc: 'Every save creates a version. Restore any previous state.' },
            { title: 'Public sharing', desc: 'Toggle a link to share read-only views with anyone.' },
          ].map(f => (
            <div key={f.title} className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
