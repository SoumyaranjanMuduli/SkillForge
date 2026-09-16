# Security acceptance tests

- Anonymous users receive 401 from attempt mutations.
- User A cannot start or save answers for User B's attempt.
- User A cannot read User B's attempt/result.
- User-facing question payloads contain no `answerKey`/`answer_key`.
- User-facing attempt payloads contain no question snapshot or answer key.
- User cannot update attempt score/status/release fields.
- User cannot call admin question/review/release mutations successfully.
- Answers are rejected after server-side assessment expiry.
- A released attempt cannot be edited by an admin review endpoint.
- Historical attempts grade against their start-time snapshot after question edits.
- Submitted Python/SQL never executes inside the Next.js process.
