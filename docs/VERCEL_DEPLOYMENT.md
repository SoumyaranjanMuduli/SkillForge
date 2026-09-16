# Vercel deployment checklist

## 1. GitHub

Create a repository and push the project folder.

## 2. Vercel

Import the repository. Vercel detects Next.js automatically.

Build command:

```text
npm run build
```

No custom output directory is needed.

## 3. Environment variables

Add these in Vercel Project Settings → Environment Variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
EXECUTION_API_URL
EXECUTION_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SENTRY_DSN
RESEND_API_KEY
ADMIN_EMAIL
NOTIFICATIONS_FROM_EMAIL
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `EXECUTION_API_KEY` or other private secrets to `NEXT_PUBLIC_*` variables.

## 4. Supabase

Run `db/schema.sql` on a new Supabase project. For an existing project, apply the numbered files in `db/migrations/` in order. `db/seed.sql` is optional development content; do not treat seed data as production data.

Create a normal account at `/register`. Keep Supabase **Confirm email** enabled. For the initial administrator, set `ADMIN_EMAIL` in Vercel to the single authorized administrator email, then use `/admin/create-password`. The server sends an invite/recovery link, verifies the authenticated email against `ADMIN_EMAIL`, provisions the `profiles` row with `role=admin`, and verifies the persisted role before redirecting to the dashboard. Do not put the admin email or password in client source code. Do not manually edit the role in the browser or store it in localStorage.

## 5. Rate limiting

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel. Assessment start, answer-save and submit endpoints reject requests in production if the limiter cannot be initialized or Upstash is unavailable.

## 6. Authentication settings

Set the Supabase Site URL to the Vercel production URL and add the production callback URL: `/auth/callback`. Also make sure the canonical value in `NEXT_PUBLIC_APP_URL` exactly matches the deployed origin (no trailing slash). Keep **Confirm email** enabled. Configure verification and recovery email templates/redirect settings so both PKCE `code` links and token-hash links can return to the deployed app.

## 7. Smoke test

- Register a user.
- Login.
- Open SQL Level 1.
- Confirm countdown works.
- Move between questions.
- Submit.
- Confirm an attempt exists in `attempts`.
- Confirm answers exist in `attempt_answers`.
- Complete the fixed admin setup with `ADMIN_EMAIL`.
- Review the attempt.
- Release the result.
- Confirm the user can see the detailed review only after release.
