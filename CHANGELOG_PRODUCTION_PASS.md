# SkillForge — Production Engineering Pass

This ZIP is an in-place hardening pass over the existing SkillForge project.

## Implemented
- Replaced admin dashboard demo counters with live Supabase aggregates.
- Replaced admin users page placeholder with live profiles/auth data, attempt metrics and access controls.
- Added user detail pages and disabled/active account API.
- Replaced admin programs page demo data with live program records and CRUD form/API.
- Added real hierarchical `topics` table, RLS and topic creation UI/API.
- Replaced question bank demo inventory with live database inventory.
- Replaced assessments demo inventory with live database inventory and added an assessment builder.
- Added assessment assignment API.
- Fixed attempt question ordering by rendering the immutable snapshot/order created at attempt start.
- Fixed randomized option ordering by snapshotting the randomized choices.
- Added attempt resume endpoint with saved answers.
- Made max-attempt creation atomic through `start_attempt_atomic` PostgreSQL RPC.
- Added answer activity logging.
- Tightened result release so under-review attempts cannot be released.
- Fixed manual-review completion to consider only answers explicitly requiring review.
- Added execution-backed SQL/Python grading hooks with partial test scoring.
- Added a separately deployable execution runner under `runner/`.
- Added production environment/runner documentation.
- Added `npm run verify` for typecheck + lint + build.

## Required deployment step
The application requires Supabase migration `002_production_pass.sql` to be applied before using the new topic and atomic-attempt features.

For SQL/Python assessments, deploy `runner/` separately. The runner must be isolated from the application and production database. Use a no-network container, resource limits, ephemeral filesystem and no application secrets.

## Verification note
The source ZIP was inspected and the Python runner was syntax-checked. Full TypeScript/build verification could not be completed in this environment because dependencies were not installed; `npm ci` timed out. Run `npm ci` followed by `npm run verify` locally or in CI before production deployment.
