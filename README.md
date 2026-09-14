# SkillForge — Multi-Program Assessment & Practice Platform

Production-oriented Next.js assessment platform for SQL, Excel, Python, Data Engineering, Data Analytics, Power BI, Tableau, Statistics, Aptitude, JavaScript, Java, C/C++, and future programs. Programs and questions are data-driven; adding a program does not require a new application module.

## Stack

Next.js App Router + TypeScript + React + Tailwind + Supabase Auth/PostgreSQL/Storage + RLS. TanStack Table, React Hook Form, Zod, Recharts, Monaco Editor and HyperFormula are supported in the application. Upstash, Inngest, Sentry and Resend are wired as optional production integrations. Vercel hosts the web app; untrusted code runs only in a separate isolated execution service.

## Security boundary

The raw `questions.answer_key` column is admin-only. User-facing question reads are server-side and deliberately omit answer keys. Each attempt receives an immutable question/grading snapshot so later question edits do not change historical grading. Users cannot update attempt score/status/release fields. The assessment timer is derived from server `started_at`, not browser state.

Never execute submitted code with `eval`, `exec`, `child_process`, or similar inside Vercel. Use the runner contract in `runner/README.md` and configure `EXECUTION_API_URL`/`EXECUTION_API_KEY` for authoritative SQL/Python execution.

## Setup

1. Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Run `npm install`.
4. Create a Supabase project.
5. For a new database, run `db/schema.sql` and then `db/seed.sql`.
6. For an existing database created from an older version, run migrations `001` through `004` in order.
7. For first-time admin setup, open `/admin/create-password`, use `soumyaranjanliku16@gmail.com`, verify the email, then create the admin password. No admin password is stored in source code.
8. Start with `npm run dev`.

The initial admin identity is allowlisted server-side to `soumyaranjanliku16@gmail.com`.

## Environment

See `.env.example`. Only `NEXT_PUBLIC_*` values intended for the browser may be exposed client-side. Never expose `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `EXECUTION_API_KEY`, or provider private keys.

## Vercel

Push to GitHub, import into Vercel, set build command to `npm run build`, add environment variables, and deploy. Supabase remains the persistence layer. The external runner is deployed separately and is not a Vercel function.

## Existing-project migration

The hardening migration preserves existing tables and adds program metadata, question versioning, assessment configuration, immutable attempt snapshots, safer RLS, and indexes. Historical attempts are not rewritten.

## Product build contract

The complete global-launch feature specification is in `docs/SKILLFORGE_GLOBAL_LAUNCH_MASTER_PROMPT.md`. Use `docs/FEATURE_MATRIX.md` to distinguish the production foundation already in this package from features that still need their full backend/UI implementation.

The admin question workflow now supports Excel/XLS/CSV upload, direct spreadsheet paste, server validation, existing-ID detection, duplicate detection, a 2,000-row import cap, draft → in-review → published lifecycle for manual edits, and downloadable row-level error reports.

## Verification

Run:

```bash
npm run verify
```

`npm run verify` runs the security audit, TypeScript, ESLint and the production build in that order.

Critical security tests must include: user A cannot read user B attempts; users cannot read answer keys; users cannot change score/status; users cannot release results; expired attempts cannot accept answers; non-admins cannot access admin mutations.
