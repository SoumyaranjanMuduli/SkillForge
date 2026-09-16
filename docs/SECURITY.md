# SkillForge security model

Question answer keys are never selected by user-facing question queries. They remain server-side and are copied into an admin-only attempt snapshot when an attempt starts. User result queries return only safe answer fields.

Assessment expiry is calculated from the server-recorded `started_at`. Browser timers are display-only.

Submitted code is not executed by Next.js. SQL/Python execution must go through `EXECUTION_API_URL`, an external isolated runner. The browser SQL/Python workspace is practice tooling only and must not be treated as authoritative grading.

Every mutation endpoint authenticates, authorizes, validates with Zod, verifies resource ownership, and derives user/role/score/status server-side.
