import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const failures = []
const check = (ok, msg) => ok ? null : failures.push(msg)
const text = (p) => readFileSync(join(root, p), 'utf8')

const required = [
  'app/(auth)/forgot-password/page.tsx',
  'app/(auth)/reset-password/page.tsx',
  'app/auth/callback/route.ts',
  'app/admin/login/page.tsx',
  'app/admin/create-password/page.tsx',
  'app/admin/layout.tsx',
  'app/verify-email/page.tsx',
  'app/api/admin/bootstrap/route.ts',
  'app/api/admin/questions/import/parse/route.ts',
  'app/api/admin/questions/import/paste/route.ts',
  'app/api/admin/questions/import/commit/route.ts',
  'db/schema.sql',
  'lib/supabase/database.types.ts',
]
for (const p of required) check(existsSync(join(root, p)), `missing required file: ${p}`)

const adminEmail = 'soumyaranjanliku16@gmail.com'
for (const p of ['app/admin/login/page.tsx', 'app/admin/create-password/page.tsx', 'app/api/admin/bootstrap/route.ts', 'app/verify-email/page.tsx']) {
  if (existsSync(join(root, p))) check(text(p).includes(adminEmail), `admin email missing from ${p}`)
}

check(text('db/schema.sql').includes("'in_review'"), 'schema missing in_review question state')
check(text('db/schema.sql').includes('question_import_batches'), 'schema missing question_import_batches')
check(text('lib/supabase/database.types.ts').includes('updated_at: string'), 'database types missing updated_at')
check(text('lib/excel-import.ts').includes('Duplicate question id'), 'import parser missing duplicate-row rejection')
check(text('lib/excel-import.ts').includes("XLSX.read(text, { type: 'string', raw: true })"), 'paste parser is not configured for CSV/TSV auto-detection')
check(text('app/auth/callback/route.ts').includes('verifyOtp'), 'auth callback missing token-hash verification support')
check(text('app/auth/callback/route.ts').includes('exchangeCodeForSession'), 'auth callback missing PKCE code exchange')
check(text('app/(auth)/register/page.tsx').includes('/verify-email?email='), 'registration does not enter verification flow')
check(!text('app/(auth)/register/page.tsx').includes("data.session ? '/dashboard'"), 'registration still has direct session-to-dashboard routing')
check(text('lib/supabase/server.ts').includes("throw new Error('Supabase client is not configured')"), 'server Supabase client does not fail closed')
check(text('lib/supabase/client.ts').includes("throw new Error('Supabase client is not configured')"), 'browser Supabase client does not fail closed')
check(text('lib/assessment.ts').includes('if (!configured()) return []'), 'assessment reads still contain a demo fallback')
check(text('middleware.ts').includes("return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 })"), 'middleware does not fail closed for missing auth configuration')
check(text('lib/rate-limit.ts').includes("return process.env.NODE_ENV !== 'production'"), 'rate-limit handler does not fail closed in production')
check(text('lib/excel-import.ts').includes('MAX_IMPORT_ROWS = 2000'), 'bulk import row cap is missing')
check(text('app/api/admin/questions/route.ts').includes("status:q.status ?? existingById.get(q.id)?.status ?? 'draft'"), 'manual question upsert does not default safely to draft')
check(text('app/api/admin/questions/route.ts').includes('Invalid status transition'), 'manual question status transition guard is missing')
check(text('app/api/admin/results/[attemptId]/review/route.ts').includes('pendingReview'), 'review completion does not account for grading failures/manual-review flags')
check(text('app/practice/page.tsx').includes("redirect('/login')"), 'practice page is not protected by authentication')
check(text('app/practice/[questionId]/page.tsx').includes("redirect('/login')"), 'practice question page is not protected by authentication')

const apiFiles = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory() && name !== 'node_modules' && name !== '.next') walk(p)
    else if (s.isFile() && p.endsWith('/route.ts')) apiFiles.push(p)
  }
}
walk(join(root, 'app/api/admin'))
for (const p of apiFiles) {
  const rel = relative(root, p)
  if (!rel.endsWith('/bootstrap/route.ts')) check(text(rel).includes('requireAdmin'), `admin API missing requireAdmin: ${rel}`)
}

const sourceDirs = ['app', 'components', 'lib', 'scripts', 'types']
for (const dir of sourceDirs) {
  const base = join(root, dir)
  if (!existsSync(base)) continue
  const stack = [base]
  while (stack.length) {
    const cur = stack.pop()
    for (const name of readdirSync(cur)) {
      const p = join(cur, name)
      const s = statSync(p)
      if (s.isDirectory()) stack.push(p)
      else if (s.size === 0) failures.push(`empty source file: ${relative(root, p)}`)
    }
  }
}

const forbidden = ['.env', '.env.local', 'tsconfig.tsbuildinfo']
for (const p of forbidden) check(!existsSync(join(root, p)), `release contains forbidden/generated file: ${p}`)

let allText = ''
for (const dir of ['app', 'components', 'lib']) {
  const base = join(root, dir)
  if (!existsSync(base)) continue
  const stack = [base]
  while (stack.length) {
    const cur = stack.pop()
    for (const name of readdirSync(cur)) {
      const p = join(cur, name)
      const s = statSync(p)
      if (s.isDirectory()) stack.push(p)
      else if (/\.(ts|tsx|js|mjs|json)$/.test(name)) allText += text(relative(root, p)) + '\n'
    }
  }
}
check(!/-----BEGIN [^-]*PRIVATE KEY-----/.test(allText), 'private key material found in source')
check(!/demo\.supabase\.co|demo-key/.test(allText), 'demo Supabase credentials found in source')

if (failures.length) {
  console.error(`AUDIT FAILED (${failures.length})`)
  for (const f of failures) console.error(`- ${f}`)
  process.exit(1)
}
console.log('AUDIT PASSED')
console.log(`Checked required auth/import/security contracts and ${apiFiles.length} admin API routes.`)
