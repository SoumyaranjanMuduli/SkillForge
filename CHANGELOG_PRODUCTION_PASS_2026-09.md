# Production hardening pass — Sept 2026

Verified by actually running `npm install && npx tsc --noEmit && npx eslint . --max-warnings=0 && npx next build` against the fixed tree (all four pass clean), not just manual review.

## Bugs fixed (from manual code review)

1. **Grading silently mishandled `code`, `data_engineering`, `case_study` questions** (`lib/grading.ts`)
   - `data_engineering` and `case_study` are open-ended/written-response types with no automated grader. `requiresManualReview()` now routes them to manual review instead of falling through to an exact-string match against the answer key.
   - `code` now runs through the isolated execution service (same sandbox as `python`, since that's the only general-purpose language the runner supports — see `runner/server.py`). If `graderConfig.language` names anything other than `python`, or `graderConfig.tests` is missing, it goes to manual review with a clear reason instead of silently mis-grading.
   - Added all three types to the single-question admin form's type dropdown (`app/admin/questions/new/page.tsx`); bulk import already supported them.

2. **Rate limiter failed closed with no Redis configured in production** (`lib/rate-limit.ts`)
   - Now fails **open** (allows the request) when Upstash env vars are missing, with a loud one-time `console.error` naming the exact missing env vars so it can't fail silently on deploy day.
   - Also fails open (with a logged error) on a transient Upstash request failure, instead of throwing and 500ing every request during a Redis blip.

3. **SQL practice preview ignored the question's real dataset** (`components/CodeWorkspace.tsx`, `lib/assessment.ts`, `lib/types.ts`)
   - Added `Question.practiceDataset`: a safe, public subset of `graderConfig` containing only the `dataset` key (the input tables) — never `expected`/`tests`/tolerance/anything answer-adjacent. Extracted server-side in `lib/assessment.ts` via a dedicated `publicDataset()` helper so the rest of `graderConfig` never reaches the client.
   - `CodeWorkspace`'s "Run" button and Schema tab now use `q.practiceDataset` when present, falling back to the EMP/DEPT demo tables only for questions that don't define a custom dataset — so the in-browser preview matches what the server actually grades against.

4. **`resend` dependency was never called anywhere** (`lib/notifications.ts`, new)
   - Added a real notification module (safe no-op + logged warning if `RESEND_API_KEY` isn't set, never throws into the caller).
   - Wired into `app/api/admin/results/[attemptId]/release/route.ts` (student gets emailed when results are released) and `app/api/admin/assignments/route.ts` (student gets emailed when assigned a new assessment).

5. **Double-submit race condition** (`app/api/attempts/[attemptId]/submit/route.ts`)
   - Added an atomic claim step: `UPDATE attempts SET status='submitted' WHERE id=? AND status='in_progress'`. Only the request that actually flips the row proceeds to grading; every other concurrent request (double-click, client retry) gets a clean 409 instead of re-running grading.
   - Wrapped grading in try/catch: if grading fails unexpectedly after the claim, status is reverted to `in_progress` so the attempt isn't stuck in limbo — this is a real behavior change from the original code, not just the atomicity fix, so noting it explicitly.

## Additional issues found during this pass (not on the original list)

6. **No MCQ / multi-select / true-false answer UI existed anywhere.** `AssessmentRunner` and `PracticeRunner` always rendered the Monaco code editor regardless of question type — there was no radio/checkbox UI in the codebase at all (`choices` was modeled in the DB and import pipeline but never rendered). Added `components/QuestionAnswer.tsx`, a shared component that renders proper choice buttons for `mcq`/`true_false`/`multi_select` (producing exactly the string format `lib/grading.ts` expects — a single value or a comma-joined list), a number input for `numeric`, and a textarea for `text`/`case_study`/`data_engineering`/`manual_review`, falling back to `CodeWorkspace` for `sql`/`python`/`excel`/`code`. Both runners now use it. Also added a "Choices" textarea to the single-question admin form, since it previously had no way to set `choices` at all for mcq/multi_select/true_false questions created outside of bulk import.

7. **Pre-existing TypeScript compile error** in `lib/excel-import.ts` (`coerceRow`'s success path was missing the required `errors` field) — this failed `tsc --noEmit` and would have failed `next build`. Fixed by returning `errors: []` on the success path.

## Verified, not touched
- `AssessmentRunner.tsx` autosave/recovery — confirmed correct.
- `runner/server.py` — Python import blocklist is documented defense-in-depth only; the real boundary is the container config in `run-production.sh`. Confirmed the boundary flags (`--network=none`, read-only root fs, dropped caps, non-root, resource limits) are actually present there.
- Assessment start logic — atomic RPC with rollback, randomization, marks overrides — confirmed correct.
