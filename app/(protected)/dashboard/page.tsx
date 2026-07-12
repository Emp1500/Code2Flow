import Link from 'next/link'
import { FileCode2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FlowchartCard } from '@/components/dashboard/FlowchartCard'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import type { Flowchart } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } }   = await supabase.auth.getUser()
  const { data: flowcharts } = await supabase
    .from('flowcharts')
    .select('*')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Flowcharts</h1>
            {flowcharts?.length ? (
              <p className="text-sm text-muted-foreground mt-1">
                {flowcharts.length} {flowcharts.length === 1 ? 'flowchart' : 'flowcharts'}
              </p>
            ) : null}
          </div>
          <Link href="/editor">
            <Button className="gap-1.5">
              <Plus className="size-4" />
              New flowchart
            </Button>
          </Link>
        </div>
        {!flowcharts?.length ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center border border-dashed border-border rounded-lg bg-card/40">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-primary/10 text-primary mb-1">
              <FileCode2 className="size-6" />
            </div>
            <h2 className="text-base font-medium">Your canvas is empty</h2>
            <p className="text-sm text-muted-foreground">Create your first flowchart to get started.</p>
            <Link href="/editor" className="mt-2">
              <Button className="gap-1.5">
                <Plus className="size-4" />
                New flowchart
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(flowcharts as Flowchart[]).map(fc => <FlowchartCard key={fc.id} flowchart={fc} />)}
          </div>
        )}
      </main>
    </div>
  )
}
