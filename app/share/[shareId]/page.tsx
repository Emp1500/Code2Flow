import { notFound }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShareView }    from '@/components/share/ShareView'

export default async function SharePage({ params }: { params: { shareId: string } }) {
  const supabase = createClient()

  const { data: fc } = await supabase
    .from('flowcharts')
    .select('id, title, language, share_id, user_id')
    .eq('share_id', params.shareId)
    .eq('is_public', true)
    .single()

  if (!fc) notFound()

  const { data: version } = await supabase
    .from('flowchart_versions')
    .select('code')
    .eq('flowchart_id', fc.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <ShareView
      flowchart={{ ...fc, code: version?.code ?? '' }}
      currentUserId={user?.id ?? null}
    />
  )
}
