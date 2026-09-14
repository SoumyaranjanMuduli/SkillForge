# Pass 2 changelog — Excel importer workflow

## What changed

**Real Excel/CSV importer (was: paste-JSON-only textarea)**
- `lib/excel-import.ts` — parses `.xlsx`/`.xls`/`.csv` (via `xlsx`/SheetJS), maps
  template columns to internal fields, coerces types, and validates every row
  with Zod. Returns per-row errors/warnings; never touches the database.
- `app/api/admin/questions/import/parse/route.ts` — upload endpoint for the
  preview step. Validates file type/size, cross-checks `program` against the
  live `programs` table, returns the full row-by-row report.
- `app/api/admin/questions/import/commit/route.ts` — takes the
  already-validated rows plus a chosen batch status, re-validates
  server-side (never trusts the client), versions any rows being overwritten,
  writes a `question_import_batches` audit record, and upserts.
- `app/admin/questions/import/page.tsx` — rebuilt: file picker → preview table
  (counts, per-row errors highlighted, duplicate-id detection) → explicit
  draft/in_review/published choice → commit → confirmation. No more "paste a
  JSON blob and hope."

**Draft → review → publish lifecycle (was: everything hardcoded to `published`)**
- `db/migrations/004_question_import_workflow.sql` — widens
  `questions.status` to `draft | in_review | published | archived` and adds
  `question_import_batches` for audit/rollback of bulk imports.
- `app/api/admin/questions/route.ts` — `POST`/`PATCH` now accept an explicit
  `status`; single-question creation still defaults to `published` if the
  caller doesn't specify one, so the existing "add question" form keeps
  working unchanged.
- `components/admin/QuestionsTable.tsx` — added a "Send to review" / "Publish"
  action per row so admins can move a question through the lifecycle from
  the question bank itself.
- `lib/supabase/database.types.ts` — added the `question_import_batches`
  table type (needed so the typed Supabase client compiles against it).
- `public/templates/question-import-template.csv` — the existing template is
  now actually downloadable from the import page.

## Still ahead (per your priority order)
3. Test-case builder + assessment builder — assessment builder already has a
   real form/question-picker (`app/admin/assessments/new/builder.tsx`); the
   test-case builder for code/SQL questions doesn't exist yet and is next.
4. Isolated code execution hardening (`runner/server.py` + `lib/execution.ts`)
   — the client-side contract (timeouts, config checks, response validation)
   is solid; the runner service itself needs a real security review
   (sandboxing, resource limits, network egress) before it's safe to deploy.

## To verify locally (I have no network access in this sandbox)
```
npm install
npm run typecheck
npm run lint
npm run build
```
Then apply `db/migrations/004_question_import_workflow.sql` to your Supabase
project before using the importer (it adds the new status value and the
`question_import_batches` table the API routes write to).
