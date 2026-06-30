import Link from 'next/link'
import { FileCode2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FlowchartCard } from '@/components/dashboard/FlowchartCard'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import type { Flowchart } from '@/types'

export default async function DashboardPage() {
  const supabase = createClient()
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
          <h1 className="text-2xl font-semibold">My Flowcharts</h1>
          <Link href="/editor">
            <Button>New flowchart</Button>
          </Link>
        </div>
        {!flowcharts?.length ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <FileCode2 className="size-12 text-muted-foreground/40" />
            <h2 className="text-base font-medium">Your canvas is empty</h2>
            <p className="text-sm text-muted-foreground">Create your first flowchart to get started.</p>
            <Link href="/editor" className="mt-2">
              <Button>New flowchart</Button>
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
