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
  'app/api/admin/setup/route.ts',
  'app/api/admin/questions/import/parse/route.ts',
  'app/api/admin/questions/import/paste/route.ts',
  'app/api/admin/questions/import/commit/route.ts',
  'db/schema.sql',
  'db/migrations/006_security_hardening.sql',
  'lib/supabase/database.types.ts',
]
for (const p of required) check(existsSync(join(root, p)), `missing required file: ${p}`)

for (const p of ['app/admin/login/page.tsx', 'app/admin/create-password/page.tsx']) {
  if (existsSync(join(root, p))) check(!/ADMIN_EMAIL|soumyaranjanliku16@gmail\.com/.test(text(p)), `admin allowlist must not be hardcoded in client code: ${p}`)
}
check(text('lib/admin-config.ts').includes('process.env.ADMIN_EMAIL'), 'server admin configuration must use ADMIN_EMAIL')
check(text('app/api/admin/setup/route.ts').includes('inviteUserByEmail'), 'admin setup must use server-side invite flow')
check(text('app/api/admin/bootstrap/route.ts').includes('.upsert('), 'admin bootstrap must upsert the profile instead of silently updating zero rows')
check(text('app/api/admin/bootstrap/route.ts').includes("profile.role !== 'admin'"), 'admin bootstrap must verify the persisted admin profile')
check(text('app/api/admin/bootstrap/route.ts').includes("existing?.status === 'disabled'"), 'admin bootstrap must reject a disabled persisted profile')

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
check(text('middleware.ts').includes("Authentication is not configured."), 'middleware does not fail closed for missing auth configuration')
check(text('lib/rate-limit.ts').includes("return process.env.NODE_ENV !== 'production'"), 'rate-limit handler does not fail closed in production')
check(text('middleware.ts').includes('isTrustedMutationRequest'), 'middleware does not enforce same-origin API mutations')
check(text('lib/request-security.ts').includes('Content-Security-Policy'), 'security response headers are missing')
check(text('lib/admin-config.ts').includes("NEXT_PUBLIC_APP_URL must be a valid HTTPS origin in production"), 'admin invite redirect origin does not fail closed in production')
check(text('app/api/attempts/[attemptId]/route.ts').includes('delete safeQuestion.explanation'), 'active assessment API does not redact grading explanations')
check(text('db/migrations/006_security_hardening.sql').includes('revoke all on function public.start_attempt_atomic'), 'security-definer RPC privilege hardening is missing')
check(text('lib/excel-import.ts').includes('MAX_IMPORT_ROWS = 2000'), 'bulk import row cap is missing')
check(text('app/api/admin/questions/route.ts').includes("status: q.status ?? existingById.get(q.id)?.status ?? 'draft'"), 'manual question upsert status handling is not fail-safe')
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
  if (!rel.endsWith('/bootstrap/route.ts') && !rel.endsWith('/setup/route.ts')) check(text(rel).includes('requireAdmin'), `admin API missing requireAdmin: ${rel}`)
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

const forbidden = ['.env', '.env.local']
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

// Repository-wide production checks.
const forbiddenSecretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!YOUR_|<|$)[^\s#]+/i,
  /DATABASE_URL\s*=\s*postgres(?:ql)?:\/\/[^\s#]+:[^\s#]+@/i,
  /EXECUTION_API_KEY\s*=\s*(?!YOUR_|<|$)[A-Za-z0-9_-]{24,}/i,
  /UPSTASH_REDIS_REST_TOKEN\s*=\s*(?!YOUR_|<|$)[A-Za-z0-9_-]{24,}/i,
  /RESEND_API_KEY\s*=\s*re_[A-Za-z0-9_-]{20,}/i,
]
const envExample = existsSync(join(root, '.env.example')) ? text('.env.example') : ''
for (const pattern of forbiddenSecretPatterns) {
  check(!pattern.test(envExample), `Potential real credential in .env.example: ${pattern}`)
}

const requiredReleaseFiles = [
  'lib/course-catalog.ts',
  'lib/course-library.ts',
  'lib/practice-bank.ts',
  'data/practice/sql.json',
  'data/practice/python.json',
  'data/practice/excel.json',
  'data/practice/numpy.json',
  'data/practice/pandas.json',
]
for (const file of requiredReleaseFiles) check(existsSync(join(root, file)), `missing required practice/course file: ${file}`)
for (const file of ['data/practice/sql.json','data/practice/python.json','data/practice/excel.json','data/practice/numpy.json','data/practice/pandas.json']) {
  if (!existsSync(join(root, file))) continue
  try {
    const rows = JSON.parse(text(file))
    check(Array.isArray(rows) && rows.length >= 200, `${file} must contain at least 200 practice questions`)
  } catch {
    check(false, `${file} is not valid JSON`)
  }
}
check(text('lib/assessment.ts').includes('getAttemptRank'), 'assessment rank helper is missing')
check(text('lib/supabase/database.types.ts').includes('finalize_attempt_atomic'), 'database types missing finalize_attempt_atomic')
check(text('lib/supabase/database.types.ts').includes('commit_question_import_atomic'), 'database types missing commit_question_import_atomic')
check(text('runner/server.py').includes('MAX_CONCURRENT_EXECUTIONS'), 'execution runner concurrency guard is missing')
check(text('runner/requirements.txt').includes('numpy==1.26.4'), 'runner missing NumPy dependency')
check(text('runner/requirements.txt').includes('pandas==2.2.3'), 'runner missing Pandas dependency')
check(text('package.json').includes('https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz'), 'xlsx must use the patched SheetJS CDN release')
check(text('package.json').includes('\"next\": \"15.5.25\"'), 'Next.js must be pinned to the audited patched release')
check(text('lib/assessment.ts').includes('const value = (graderConfig as Record<string, unknown>).publicDataset'), 'public practice datasets must be explicitly marked publicDataset')
check(text('runner/server.py').includes('MAX_RESULT_ROWS'), 'runner SQL result row cap is missing')
check(text('runner/server.py').includes('MAX_RESULT_BYTES'), 'runner SQL result byte cap is missing')
check(text('db/schema.sql').includes('start_attempt_with_snapshots'), 'atomic assessment start RPC is missing from schema')
check(text('db/schema.sql').includes('save_attempt_answer_atomic'), 'atomic answer-save RPC is missing from schema')
check(existsSync(join(root, 'db/migrations/009_atomic_attempt_hardening.sql')), 'missing atomic attempt hardening migration')

if (failures.length) {
  console.error(`AUDIT FAILED (${failures.length})`)
  for (const f of failures) console.error(`- ${f}`)
  process.exit(1)
}
console.log('AUDIT PASSED')
console.log(`Checked auth/import/security contracts, practice banks, and ${apiFiles.length} admin API routes.`)
