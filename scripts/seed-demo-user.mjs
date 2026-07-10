// Creates a pre-confirmed demo/test user via Supabase's admin API, bypassing
// GoTrue's signup email flow entirely (no email sent, so unaffected by the
// project's email rate limit). For local/dev testing only - never run
// against a production project with real user data you care about.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const [, , email = 'demo123@gmail.com', password = '123456', username = 'demo123'] = process.argv

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { username },
})

if (error) {
  console.error('Failed to create demo user:', error.message)
  process.exit(1)
}

console.log(`Demo user ready — email: ${email}  password: ${password}  userId: ${data.user.id}`)
