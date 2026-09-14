# SkillForge production pass

This revision replaces the demo admin screens with Supabase-backed pages and adds the missing production primitives.

## Apply database changes
Run `db/schema.sql` for a fresh database, or run migrations `001_skillforge_hardening.sql` and `002_production_pass.sql` in order on an existing database.

`002_production_pass.sql` adds `topics`, profile access status, indexes, and the atomic `start_attempt_atomic` RPC used to prevent max-attempt races.

## Environment
Use:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `EXECUTION_API_URL`
- `EXECUTION_API_KEY` (server only)

Never prefix server secrets with `NEXT_PUBLIC_`.

## Execution runner
Vercel must not execute untrusted Python/SQL. The included runner contract remains separate. The runner endpoint must be deployed in a locked-down container/VM with no network, ephemeral filesystem, non-root user, CPU/memory/process limits, timeout and no production credentials.

## Assessment flow
Attempt start is server-authoritative. The server generates and snapshots the exact question order and option order. The attempt API renders snapshots rather than reconstructing the assessment from the current question bank.

## Remaining operational requirement
A production SQL/Python runner still has to be deployed and configured. The application intentionally fails closed for authoritative code execution when `EXECUTION_API_URL` is absent; browser practice remains separate from assessment grading.
