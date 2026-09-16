# SkillForge authentication setup

The source code intentionally does **not** contain Supabase credentials. Authentication cannot work until the project is connected to a Supabase project.

## Local development

1. Create/open your Supabase project.
2. In the project root, copy `.env.example` to `.env.local`.
3. Set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAIL=your-admin-email@example.com
```

4. Run the consolidated `db/schema.sql` once on a fresh Supabase project (SQL Editor → paste → Run), then `db/seed.sql` if you want sample data. Do not run anything in `db/migrations/` on a fresh project — that folder is only for upgrading an older, already-live database that predates the consolidated schema.
5. In Supabase Authentication → URL Configuration, add `http://localhost:3000/auth/callback` and your production callback.
6. Keep email confirmation enabled.
7. Restart Next.js after changing `.env.local`:

```bash
npm run dev
```

## Vercel

Add the same variables in Vercel → Project Settings → Environment Variables. Apply them to the Production environment, then redeploy. `NEXT_PUBLIC_*` values are embedded during the build, so changing them without a new deployment will not fix an already-built frontend.

## Expected auth flow

`/login` and `/register` are the only normal public auth pages. An unauthenticated visitor cannot open dashboard, courses, practice, assessments, results, profile, notifications, or admin routes. After successful registration/email verification and login, a new student is sent to `/account/setup` to enter name, age, gender, and birth year. Only after setup is complete does the user enter `/dashboard`.
