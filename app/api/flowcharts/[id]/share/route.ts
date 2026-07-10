import { createClient }    from '@/lib/supabase/server'
import { generateShareId } from '@/lib/share'
import { shareLimit, checkRateLimit } from '@/lib/rate-limit'
import { NextResponse }    from 'next/server'

type Params = { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, retryAfter } = await checkRateLimit(shareLimit, user.id)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  const { data: fc, error: fetchError } = await supabase.from('flowcharts').select('is_public, share_id').eq('id', params.id).single()
  if (fetchError || !fc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const toggled    = !fc.is_public
  const share_id   = toggled ? generateShareId() : fc.share_id
  const updateData = toggled ? { is_public: true, share_id } : { is_public: false }

  const { data: updated, error: updateError } = await supabase
    .from('flowcharts').update(updateData).eq('id', params.id).select('is_public, share_id').single()

  if (updateError) return NextResponse.json({ error: 'Failed to update share settings' }, { status: 500 })

  return NextResponse.json(updated)
}
