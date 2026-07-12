import { createClient }    from '@/lib/supabase/server'
import type { FlowchartVersion } from '@/types'
import { NextResponse }    from 'next/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/flowcharts/[id]/versions       → list (metadata only, no code)
// GET /api/flowcharts/[id]/versions?v=12  → single version with code
export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const vParam = searchParams.get('v')

  if (vParam) {
    const versionNumber = Number(vParam)
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 })
    }
    const res = await supabase
      .from('flowchart_versions')
      .select('id, code, version_number, created_at')
      .eq('flowchart_id', id)
      .eq('version_number', versionNumber)
      .single()
    if (res.error) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    return NextResponse.json(res.data as Pick<FlowchartVersion, 'id' | 'code' | 'version_number' | 'created_at'>)
  }

  const res = await supabase
    .from('flowchart_versions')
    .select('id, version_number, created_at')
    .eq('flowchart_id', id)
    .order('version_number', { ascending: false })

  if (res.error) {
    console.error('GET /api/flowcharts/[id]/versions failed:', res.error)
    return NextResponse.json({ error: 'Failed to load version history' }, { status: 500 })
  }
  return NextResponse.json(res.data as Pick<FlowchartVersion, 'id' | 'version_number' | 'created_at'>[])
}
