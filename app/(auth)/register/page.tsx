'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DottedSurface } from '@/components/ui/DottedSurface'

export default function RegisterPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [email,        setEmail]        = useState('')
  const [username,     setUsername]     = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)

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
      setError(error.message || 'Registration failed. Please try again.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <DottedSurface />
      <div className="text-center mb-8">
        <Link href="/" className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity duration-150">
          Code2Flow
        </Link>
        <p className="text-sm text-muted-foreground mt-1">Turn code into flowcharts</p>
      </div>
      <div className="w-full max-w-sm space-y-6 p-10 border border-t-2 border-t-primary/20 border-border ring-1 ring-border/40 shadow-xl rounded-lg bg-background">
        <h1 className="text-xl font-semibold text-center">Create your account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username" autoComplete="username"
              value={username} onChange={e => setUsername(e.target.value)} required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email" type="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)} required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline hover:text-foreground transition-colors duration-150">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
