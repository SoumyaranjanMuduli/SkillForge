# Question import

Admin question import supports `.xlsx`, `.xls`, `.csv`, and spreadsheet paste (TSV copied from Excel/Google Sheets).

## Required columns

`id`, `program`, `topic`, `title`, `question`, `questionType`, `difficulty`, `marks`, `timeLimitSec`, `answerKey`

Optional columns include `subtopic`, `instructions`, `choices`, `gradingMode`, `starterCode`, `graderConfig`, `explanation`, `tags`, and `status`.

Supported question types:

- `mcq`
- `multi_select`
- `true_false`
- `text`
- `numeric`
- `sql`
- `python`
- `excel`
- `code`
- `data_engineering`
- `case_study`
- `manual_review`

The importer accepts either the program ID or its slug, but always resolves it to the canonical program ID before writing to the database. Pasted TSV and CSV are both supported; preview performs the same server-side validation as file imports.

## Workflow

1. Admin chooses Excel/CSV or Paste.
2. Server parses the source.
3. Every row is validated with the same Zod schema.
4. Duplicate IDs inside the batch are rejected before commit.
5. Existing IDs are detected and versioned.
6. Admin reviews valid/error rows.
7. Admin selects Draft, In Review, or Published.
8. Server revalidates the live program catalog and commits.
9. The import batch and audit events are logged.

No row is saved during preview.
