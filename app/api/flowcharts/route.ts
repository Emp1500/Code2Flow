import { createClient }        from '@/lib/supabase/server'
import { SaveFlowchartSchema } from '@/lib/validations'
import { saveLimit, checkRateLimit } from '@/lib/rate-limit'
import { NextResponse }        from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('flowcharts')
    .select('id, title, language, is_public, share_id, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('GET /api/flowcharts failed:', error)
    return NextResponse.json({ error: 'Failed to load flowcharts' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, retryAfter } = await checkRateLimit(saveLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const body   = await request.json()
  const parsed = SaveFlowchartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { title, code, language } = parsed.data

  const { data: flowchart, error } = await supabase
    .from('flowcharts')
    .insert({ user_id: user.id, title, language })
    .select()
    .single()

  if (error) {
    console.error('POST /api/flowcharts failed:', error)
    return NextResponse.json({ error: 'Failed to create flowchart' }, { status: 500 })
  }

  const { error: versionError } = await supabase.from('flowchart_versions').insert({
    flowchart_id: flowchart.id, code, version_number: 1,
  })

  if (versionError) {
    await supabase.from('flowcharts').delete().eq('id', flowchart.id)
    return NextResponse.json({ error: 'Failed to save flowchart contents' }, { status: 500 })
  }

  return NextResponse.json(flowchart, { status: 201 })
}
