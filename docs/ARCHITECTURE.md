# Architecture

## Core

Next.js hosts the UI, API route handlers and server actions on Vercel. Supabase handles authentication, PostgreSQL and file storage.

## Program abstraction

Programs are rows in `programs`. Questions reference `program_id`. Assessments reference a program and choose their questions through `assessment_questions`. This is why SQL, Excel, Python and Data Engineering share the same application.

## Attempt lifecycle

```text
created
  -> in_progress
  -> submitted
  -> review (when manual review is needed)
  -> released
```

Each question answer stores the answer body, correctness state, score, time spent and admin comment.

## Code execution

The sample browser runner is intentionally separated from the server grading model. SQL practice uses AlaSQL with a small EMP/DEPT sample dataset. Python practice uses Pyodide. This keeps basic practice playable from a normal Vercel deployment.

For a real hiring/assessment environment, connect the grading API to an isolated execution service. Do not run untrusted arbitrary code in a Vercel serverless function or on the same machine as application secrets.

## Result privacy

`result_released_at` is the release gate. The UI should only return answer keys and detailed review when this value is non-null and the current user owns the attempt.
