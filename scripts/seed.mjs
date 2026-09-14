import fs from 'node:fs'
import path from 'node:path'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  process.exit(1)
}
const sql = fs.readFileSync(path.join(process.cwd(), 'db/seed.sql'), 'utf8')
console.log('Supabase JS cannot safely execute arbitrary SQL through the client. Paste db/schema.sql then db/seed.sql into Supabase SQL Editor.')
console.log(`Seed file ready: ${sql.length} characters`)
