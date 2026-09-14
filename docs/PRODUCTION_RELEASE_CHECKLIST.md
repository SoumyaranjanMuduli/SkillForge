# SkillForge production release checklist

## Required

1. Apply `db/migrations/001_skillforge_hardening.sql`, `002_production_pass.sql`, and `003_production_hardening.sql` in order to an existing database. A fresh install can use `db/schema.sql`.
2. Configure Supabase URL, anon key and service-role key. Never expose the service-role key to the browser.
3. Configure `EXECUTION_API_URL` and `EXECUTION_API_KEY` on Vercel. Keep runner credentials out of client bundles.
4. Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production. Rate-limited assessment endpoints fail closed when these are absent in production.
5. Deploy the execution runner with the controls in `runner/run-production.sh` and keep it off the public internet where possible.
6. Run `npm ci` and `npm run verify` with network access before release.
7. Create an admin profile explicitly; normal users default to the `user` role.
8. Test an assessment end-to-end: start, refresh/resume, randomized order/options, autosave, expiry, submit, grading, manual review and release.
9. Test SQL with a deliberately wrong query to prove the candidate query—not a test query—is executed.
10. Test Python timeout/import restrictions and confirm the runner cannot reach the network.
11. Test Excel with workbook JSON and expected formula/value checks.
12. Verify RLS and admin API authorization with separate student/admin accounts.
