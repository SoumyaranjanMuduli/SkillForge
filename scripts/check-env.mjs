import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())

const publicRequired = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
const productionRequired = ['SUPABASE_SERVICE_ROLE_KEY', 'EXECUTION_API_URL', 'EXECUTION_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ADMIN_EMAIL', 'NEXT_PUBLIC_APP_URL']
const required = process.env.NODE_ENV === 'production' ? [...publicRequired, ...productionRequired] : publicRequired
const missing = required.filter(key => !process.env[key]?.trim())
if (missing.length) { console.error(`Missing environment variables: ${missing.join(', ')}`); process.exit(1) }
try { new URL(process.env.NEXT_PUBLIC_SUPABASE_URL); new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost') } catch { console.error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_APP_URL must be valid URLs.'); process.exit(1) }
if (process.env.NODE_ENV === 'production') {
  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL); const executionUrl = new URL(process.env.EXECUTION_API_URL)
  if (appUrl.protocol !== 'https:' || executionUrl.protocol !== 'https:') { console.error('Production NEXT_PUBLIC_APP_URL and EXECUTION_API_URL must use HTTPS.'); process.exit(1) }
}
console.log('Environment check passed.')
