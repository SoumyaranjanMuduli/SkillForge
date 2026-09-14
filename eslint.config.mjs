import { FlatCompat } from '@eslint/eslintrc'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const compat = new FlatCompat({ baseDirectory: dirname })
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Supabase query results are typed `any` throughout the codebase because
    // no generated database types exist yet (`supabase gen types typescript`
    // requires a live project connection, which this environment doesn't have).
    // Once migrations are applied to a real Supabase project, run:
    //   supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
    // and replace `as any` casts on `createAdminClient()`/query results with the
    // generated types, then re-enable this rule as an error.
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
]
export default config
