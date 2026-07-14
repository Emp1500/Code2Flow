'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Workflow } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { GithubIcon } from '@/components/icons/GithubIcon'

const GITHUB_URL = 'https://github.com/Emp1500/Code2Flow'

export function Navbar({ user }: { user: { email?: string } | null }) {
  const router   = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight hover:opacity-80 transition-opacity duration-150">
          <span className="inline-flex items-center justify-center size-7 rounded-md bg-primary/15 text-primary">
            <Workflow className="size-4" />
          </span>
          Code2Flow
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="View Code2Flow on GitHub"
            className="inline-flex items-center justify-center size-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
          >
            <GithubIcon className="size-4" />
          </a>
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link href="/register"><Button size="sm">Get started</Button></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
