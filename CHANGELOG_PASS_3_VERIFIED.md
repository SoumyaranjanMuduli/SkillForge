# SkillForge — Third Pass (on top of "final production hardening")

This continues from `CHANGELOG_FINAL_PRODUCTION_HARDENING.md`, which added real
features (Excel/HyperFormula grading, Upstash rate limiting, atomic assessment
save, runner hardening) but was honest that it **could not run
`npm run verify`** in its environment (npm network access issues) — so none of
it had actually been typechecked, linted, or built. This pass did that, found
what broke, and fixed it. It also functionally exercised the runner and Excel
grading rather than just reading the code.

## Verified: `npm run verify` (typecheck + lint + build) passes end-to-end

It did not pass before this round. Real bugs found and fixed:

- **`database.types.ts` didn't match the actual schema.** Two tables used by
  the app (`question_versions`, `topics`) were completely missing from the
  hand-written types, and two columns that migration 003 added
  (`questions.topic_id`, `attempt_answers.grading_status`/`requires_review`)
  were missing from their table definitions. This broke every insert/update
  touching those tables under the newly-typed Supabase client. Added the
  missing tables/columns and the two RPC function signatures
  (`start_attempt_atomic`, `save_assessment_atomic`) to `Functions`.
- **A real runtime bug, not just a type error**: `app/admin/reports/page.tsx`
  referenced `pn` (the assessments lookup map) *before* declaring it in the
  same function body. This is a `const` temporal-dead-zone violation —
  it would throw `ReferenceError: Cannot access 'pn' before initialization`
  on every single load of the admin reports page. Moved the declaration
  before its first use.
- **A real duplication bug in three route files**
  (`attempts/start`, `attempts/[id]/answer`, `attempts/[id]/submit`):
  `enforceRateLimit` was imported twice and *called twice* per request in
  each — every attempt-start, answer-save, and submit request was silently
  burning two units of rate-limit budget instead of one, meaning real users
  would hit 429s roughly twice as often as intended.
- The same `Map`-type-inference bug from the previous pass recurred in
  `attempts/start/route.ts` and `admin/attempts/[attemptId]/page.tsx` — fixed
  both with explicit generics.
- Implicit-`any` parameters in the assessment builder component.
- **A real unhandled-exception bug in the runner**: the "no tests configured"
  SQL execution path only caught `duckdb.InterruptException`, not general
  errors. Confirmed by triggering it directly: a blocked-external-access query
  (or any invalid SQL) threw an uncaught `PermissionException` straight out of
  the HTTP handler instead of returning a clean error. Fixed, and added a
  top-level try/except around request dispatch as defense-in-depth so no
  future code path can leak a raw traceback or crash a request thread.
- **A real review-completion logic bug**: `app/api/admin/results/[attemptId]/review/route.ts`
  determined whether all `manual_review`-type questions had been reviewed by
  reading `x.question_snapshot?.questionType` — but the query that built `x`
  only selected `grader_config_snapshot`, never `question_snapshot`. That
  field was always `undefined`, so a `manual_review` question without an
  explicit `grader_config.mode === 'manual'` would never be counted as
  "needing review," and could get silently approved without ever being
  graded. Fixed by selecting `question_snapshot` too.

## Verified by actually running the code, not just reading it

- **Excel grading** (`lib/grading.ts` → `gradeExcel`, using HyperFormula):
  built a real workbook (`Revenue`/`Cost`/`=A2-B2`) and confirmed HyperFormula
  correctly evaluates the formula (60) and correctly distinguishes it from a
  wrong formula (`=A2+B2` → 140). The cell-reference parsing (`C2` → row/col)
  is correct.
- **Runner hardening**: confirmed (a) it refuses to start with no
  `EXECUTION_API_KEY`, (b) blocked Python imports (`os`, `subprocess`, etc.)
  are actually rejected, (c) a 2GB allocation is actually killed by the new
  memory limit, (d) DuckDB's `enable_external_access=false` actually blocks a
  network-read attempt, and (e) a runaway cross-join query is actually
  interrupted by the timeout in ~2s rather than hanging.
- Confirmed answer keys are excluded from every client-facing query path
  (`getQuestions`, the attempt-fetch route, the snapshot structure that
  separates `question_snapshot` from `answer_key_snapshot` in its own column).

## Still open — not fixed, and why

- **`tests/` is a manual markdown checklist** (`security-checklist.md`), not
  the automated `tests/grading/*.test.ts` / `tests/security/*.test.ts` suite
  from the original spec. No test runner (vitest/jest) is even a dependency.
  Writing that suite is real, substantial work this pass didn't do.
- Nothing here has been run against a live Supabase project. The types file
  is now internally consistent with `db/schema.sql`, but it's still
  hand-written, not generated from a live database — apply the migrations and
  run `supabase gen types` to get a source-of-truth version.
- The runner has not been built into an actual Docker image or run under the
  `--network=none` / read-only / capability-dropped configuration described in
  `runner/run-production.sh` — only the underlying Python functions were
  exercised directly in this sandbox. Build and smoke-test the real container
  before relying on the isolation claims.
- Rate limiting, audit logging, and RLS policies exist in code/schema but
  haven't been load-tested or exercised against concurrent real traffic.

## Before deploying

1. Apply `db/schema.sql` (or migrations 001–003) to a real Supabase project.
2. Generate real types and diff them against `lib/supabase/database.types.ts`
   to catch anything this pass's manual reconciliation missed:
   `supabase gen types typescript --project-id <id>`.
3. Build and run the runner as its own container per `runner/README.md` —
   don't run `server.py` directly on the app host.
4. Set every variable in `.env.example`. `UPSTASH_REDIS_REST_URL`/`_TOKEN` are
   required for rate limiting to actually work in production — without them,
   `enforceRateLimit` fails closed (blocks everything) per `lib/rate-limit.ts`.
5. Re-run `npm run verify` in your actual CI before shipping.
6. Turn `tests/security-checklist.md` into real automated tests before this
   handles real candidate data.
