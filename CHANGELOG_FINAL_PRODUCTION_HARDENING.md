# SkillForge final production hardening pass

## Fixed

- Corrected `/assessment/[assessmentId]` route semantics. The page now receives an assessment ID and the runner creates/resumes the real attempt before loading its snapshot.
- Removed the duplicate legacy `[attemptId]` assessment route.
- Removed the client-side pre-check race from attempt creation; the atomic database function is now the authority for active/max attempts.
- Added distributed Upstash rate limiting to attempt start, answer save and submit endpoints. Production fails closed when the Redis configuration is missing.
- Added assessment save RPC so assessment metadata and question composition are written in one database transaction.
- Added marks/time overrides to the assessment builder and snapshot them into attempts.
- Added assessment edit route and assignment page.
- Added admin attempt detail view with per-question answers, score, timing and review state.
- Added program/topic/question archive endpoints and question update/version-history storage.
- Added dynamic program loading to the question form.
- Corrected `manual` to `manual_review`.
- Fixed report/dashboard/user pass-rate logic to use each assessment's configured passing score.
- Added explicit grading status and `requires_review` fields.
- Centralized manual-review detection.
- Tightened review endpoint to accept only reviewable attempt states.
- Added HyperFormula-based Excel workbook evaluation using workbook JSON and expected formula/value checks.
- Fixed SQL grading so test definitions provide expected results; they no longer replace the student's SQL query.
- Disabled DuckDB external access before student SQL execution.
- Made the execution runner authentication fail closed.
- Added Python defense-in-depth import restrictions and resource limits.
- Added production Docker runner command with no network, read-only root filesystem, dropped capabilities, no-new-privileges, PID/CPU/memory limits and loopback-only port publishing.
- Added production release checklist and runner contract documentation.

## Verification performed in this environment

- ZIP extraction: pass.
- Python runner syntax compilation: pass.
- Python runner authenticated execution smoke test: pass.
- Runner missing/invalid authorization: returns 401.
- Restricted Python import smoke test: blocked.
- No admin-page imports of demo user/attempt/program/assessment datasets remain.
- Legacy assessment route removed.

## Not independently verifiable here

The environment did not contain the installed Node dependency tree. Two attempts to run `npm ci` timed out before dependencies became available, so `npm run typecheck`, `npm run lint`, and `npm run build` could not be independently executed here.

Before production release, run `npm ci && npm run verify` on a machine/CI runner with working npm network access. Also apply migrations 001, 002 and 003 to an existing Supabase database and run an end-to-end staging assessment with SQL, Python, Excel, randomized questions/options, expiry, resume, review and result release.
