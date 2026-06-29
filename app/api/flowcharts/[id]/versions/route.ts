import { createClient }    from '@/lib/supabase/server'
import type { FlowchartVersion } from '@/types'
import { NextResponse }    from 'next/server'

type Params = { params: { id: string } }

// GET /api/flowcharts/[id]/versions       → list (metadata only, no code)
// GET /api/flowcharts/[id]/versions?v=12  → single version with code
export async function GET(request: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const vParam = searchParams.get('v')

  if (vParam) {
    const res = await supabase
      .from('flowchart_versions')
      .select('id, code, version_number, created_at')
      .eq('flowchart_id', params.id)
      .eq('version_number', Number(vParam))
      .single()
    if (res.error) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    return NextResponse.json(res.data as Pick<FlowchartVersion, 'id' | 'code' | 'version_number' | 'created_at'>)
  }

  const res = await supabase
    .from('flowchart_versions')
    .select('id, version_number, created_at')
    .eq('flowchart_id', params.id)
    .order('version_number', { ascending: false })

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  return NextResponse.json(res.data as Pick<FlowchartVersion, 'id' | 'version_number' | 'created_at'>[])
}
