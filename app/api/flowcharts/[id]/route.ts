import { createClient }                        from '@/lib/supabase/server'
import { UpdateFlowchartSchema, RenameSchema } from '@/lib/validations'
import { saveLimit, checkRateLimit }           from '@/lib/rate-limit'
import { NextResponse }                        from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: fc, error }, versionRes] = await Promise.all([
    supabase.from('flowcharts').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase
      .from('flowchart_versions')
      .select('code, version_number')
      .eq('flowchart_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single(),
  ])
  if (error || !fc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const version = versionRes.data as { code: string; version_number: number } | null

  return NextResponse.json(Object.assign({}, fc, { code: version?.code ?? '', version_number: version?.version_number ?? 0 }))
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: owned, error: ownerError } = await supabase
    .from('flowcharts').select('id').eq('id', id).eq('user_id', user.id).single()
  if (ownerError || !owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { success, retryAfter } = await checkRateLimit(saveLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const body   = await request.json()
  const parsed = UpdateFlowchartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { code, ...meta } = parsed.data

  if (Object.keys(meta).length) {
    const { error: metaError } = await supabase.from('flowcharts').update(meta).eq('id', id).eq('user_id', user.id)
    if (metaError) return NextResponse.json({ error: 'Failed to update flowchart' }, { status: 500 })
  }

  if (code !== undefined) {
    const latestRes = await supabase
      .from('flowchart_versions')
      .select('version_number')
      .eq('flowchart_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()
    const latest = latestRes.data as { version_number: number } | null

    const nextVersion = (latest?.version_number ?? 0) + 1

    const { error: versionError } = await supabase.from('flowchart_versions').insert({
      flowchart_id: id, code, version_number: nextVersion,
    })
    if (versionError) return NextResponse.json({ error: 'Failed to save flowchart contents' }, { status: 500 })

    const { data: all, error: listError } = await supabase
      .from('flowchart_versions')
      .select('id, version_number')
      .eq('flowchart_id', id)
      .order('version_number', { ascending: true })

    if (listError) {
      console.error('Failed to list versions for pruning (save already succeeded):', listError)
    } else if (all && all.length > 50) {
      const toDelete = all.slice(0, all.length - 50).map(v => v.id)
      const { error: deleteError } = await supabase.from('flowchart_versions').delete().in('id', toDelete)
      if (deleteError) console.error('Failed to prune old versions (save already succeeded):', deleteError)
    }
  }

  const { data: updated, error: reloadError } = await supabase.from('flowcharts').select('*').eq('id', id).eq('user_id', user.id).single()
  if (reloadError) return NextResponse.json({ error: 'Failed to reload flowchart' }, { status: 500 })
  return NextResponse.json(updated)
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = RenameSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('flowcharts').update({ title: parsed.data.title }).eq('id', id).eq('user_id', user.id).select().single()
  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error('PATCH /api/flowcharts/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to rename flowchart' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('flowcharts').delete().eq('id', id).eq('user_id', user.id).select().single()
  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error('DELETE /api/flowcharts/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to delete flowchart' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
