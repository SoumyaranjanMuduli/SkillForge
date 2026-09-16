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
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Codebase convention: prefix an intentionally-unused var/arg with `_`
      // (e.g. destructuring to drop a field, or an unused catch binding)
      // instead of suppressing the rule entirely.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
export default config
