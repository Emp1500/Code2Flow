import { createClient }                        from '@/lib/supabase/server'
import { UpdateFlowchartSchema, RenameSchema } from '@/lib/validations'
import { saveLimit, checkRateLimit }           from '@/lib/rate-limit'
import { NextResponse }                        from 'next/server'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: fc, error } = await supabase
    .from('flowcharts').select('*').eq('id', params.id).single()
  if (error || !fc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const versionRes = await supabase
    .from('flowchart_versions')
    .select('code, version_number')
    .eq('flowchart_id', params.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()
  const version = versionRes.data as { code: string; version_number: number } | null

  return NextResponse.json(Object.assign({}, fc, { code: version?.code ?? '', version_number: version?.version_number ?? 0 }))
}

export async function PUT(request: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, retryAfter } = await checkRateLimit(saveLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const body   = await request.json()
  const parsed = UpdateFlowchartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { code, ...meta } = parsed.data

  if (Object.keys(meta).length) {
    await supabase.from('flowcharts').update(meta).eq('id', params.id)
  }

  if (code !== undefined) {
    const latestRes = await supabase
      .from('flowchart_versions')
      .select('version_number')
      .eq('flowchart_id', params.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()
    const latest = latestRes.data as { version_number: number } | null

    const nextVersion = (latest?.version_number ?? 0) + 1

    await supabase.from('flowchart_versions').insert({
      flowchart_id: params.id, code, version_number: nextVersion,
    })

    const { data: all } = await supabase
      .from('flowchart_versions')
      .select('id, version_number')
      .eq('flowchart_id', params.id)
      .order('version_number', { ascending: true })

    if (all && all.length > 50) {
      const toDelete = all.slice(0, all.length - 50).map(v => v.id)
      await supabase.from('flowchart_versions').delete().in('id', toDelete)
    }
  }

  const { data: updated } = await supabase.from('flowcharts').select('*').eq('id', params.id).single()
  return NextResponse.json(updated)
}

export async function PATCH(request: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = RenameSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('flowcharts').update({ title: parsed.data.title }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('flowcharts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
