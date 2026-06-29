import Link from 'next/link'
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
          <div className="text-center py-20 text-muted-foreground">
            <p className="mb-4">No flowcharts yet.</p>
            <Link href="/editor"><Button>Create your first</Button></Link>
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
