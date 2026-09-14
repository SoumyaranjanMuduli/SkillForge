# SkillForge — Global Launch Master Build Prompt

Use this as the authoritative production build prompt for SkillForge. It is intentionally broader than a UI brief: every feature below must be implemented end-to-end, with real persistence, authorization, observability, responsive UI and tests. Do not replace working functionality with mock screens.

## Product mission

Build SkillForge as a premium global learning, practice and assessment platform for SQL, Python, Excel, Power BI, Tableau, statistics, data analytics, data engineering, JavaScript, Java, C/C++, aptitude and future programs.

The product should feel like a luxury education SaaS: calm, fast, precise, visually rich without being noisy. Use subtle motion, layered surfaces, gentle gradients, soft shadows, crisp typography and strong spacing. Avoid gimmicky animation.

## Non-negotiable engineering principles

- Real authentication and real data; no fake login/localStorage roles.
- Admin authorization is server-side and database-enforced.
- Student responses never receive answer keys or hidden grader configuration.
- Timers and deadlines are server-authoritative.
- SQL/Python execution occurs only in an isolated runner outside Vercel.
- Every mutation is auditable.
- Bulk imports are validated server-side before commit.
- All destructive actions require confirmation and, where appropriate, a second warning.
- Every important async action has loading, success, error and empty states.
- Accessibility and reduced-motion support are first-class requirements.
- Global users need timezone, locale, language and date/number formatting support.
- Build must pass typecheck, lint and production build before release.

## 1. Premium visual system

### Brand

SkillForge wordmark + compact abstract forge/hex icon.

Primary palette: indigo/violet with restrained cyan/blue support.

Surfaces:
- Deep midnight/navy marketing background.
- White/near-white application surfaces.
- Subtle tinted panels for secondary content.
- Very soft glass/clay depth, never excessive blur.

Typography:
- Strong display heading for hero and major dashboard titles.
- High-legibility body text.
- Tabular/monospace type where code/data needs precision.

Shape language:
- 12–24px card radii depending on hierarchy.
- Pills only for statuses/tags.
- Buttons must feel tactile but not inflated.

Motion:
- 150–220ms micro-interactions.
- 300–500ms page entrance transitions.
- Stagger only for small groups.
- Progress rings and number counters may animate once on view.
- Skeleton shimmer while loading.
- Respect prefers-reduced-motion.

### UX quality bar

No overlap, no cramped mobile forms, no accidental horizontal scroll, no tiny tap targets, no layout jump when data loads, no dead buttons, no unexplained icons.

## 2. Global landing experience

Routes:
- `/`
- `/features`
- `/programs`
- `/pricing` if monetization is enabled
- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/security`
- `/status`

Landing page sections:
- Hero with strong promise, CTA and assessment preview.
- Social proof and learner statistics.
- Program cards.
- How SkillForge works: Learn → Practice → Assess → Improve → Certify.
- Feature grid.
- Real assessment UI preview.
- Career/job-readiness section.
- Testimonials or verified outcome metrics.
- FAQ.
- Final CTA.
- Global footer.

Support SEO:
- Metadata per route.
- OpenGraph/Twitter metadata.
- Canonical URLs.
- JSON-LD for Organization, WebSite, Course and FAQ where appropriate.
- XML sitemap.
- robots.txt.
- Social share previews.

## 3. Authentication

Implement:
- User registration.
- Email verification.
- Login.
- Logout.
- Forgot password.
- Password reset.
- Session refresh.
- Protected routes.
- Role-aware redirects.
- Optional Google/GitHub OAuth only when configured.
- Login rate limiting.
- Verification resend cooldown.
- Safe generic auth error messages.

Admin identity bootstrap:
- Allowed initial admin email: `soumyaranjanliku16@gmail.com`.
- Never hardcode an admin password.
- Email verification must happen through the auth provider.
- Only after verified email + secure session may the initial admin password be created.
- Admin role assignment happens server-side.

Roles should be extensible beyond `user` and `admin` in the data model, with future support for editor, reviewer, instructor and support roles.

## 4. Student onboarding

First-login onboarding wizard:
- Name.
- Country/region.
- Preferred language.
- Timezone.
- Target role/career.
- Skill level per program.
- Weekly learning goal.
- Notification preferences.

Generate a personalized dashboard from onboarding selections.

Allow onboarding to be skipped and edited later.

## 5. Student dashboard

Create a premium personal learning cockpit:
- Greeting.
- Current streak.
- Weekly goal.
- Progress ring.
- Continue learning.
- Upcoming assessments.
- Recommended practice.
- Recent results.
- Weakest topics.
- Strongest topics.
- Time spent this week.
- Certificates.
- Bookmarks.
- Notifications.

Add global search across courses, topics and questions the student is allowed to see.

## 6. Learning system

Courses/programs:
- Program catalog.
- Course/track pages.
- Modules.
- Lessons.
- Lesson progress.
- Completion state.
- Prerequisites.
- Estimated duration.
- Difficulty.
- Tags.
- Skill mapping.
- Save/bookmark.
- Resume from last position.
- Course completion certificate eligibility.

Lesson types:
- Rich text.
- Video/embed.
- Code.
- SQL.
- Excel.
- Downloadable resources.
- Case study.
- Quiz.

Admin can draft → review → publish → archive.

## 7. Practice mode

Student practice should support:
- Program filter.
- Topic/subtopic filter.
- Difficulty filter.
- Question type filter.
- Search.
- Random practice.
- Weak-topic practice.
- Incorrect-answer retry.
- Daily challenge.
- Saved/bookmarked questions.
- Practice history.

Each question may have:
- Rich text/Markdown prompt.
- Images/attachments.
- Choices.
- Code/SQL/Excel workspace.
- Hints if enabled.
- Explanation after grading.
- Related concepts.

## 8. Assessment/exam system

Features:
- Scheduled assessments.
- Time limits.
- Maximum attempts.
- Start/end window.
- Randomized question order.
- Randomized choice order.
- Question pools.
- Difficulty-balanced selection.
- Section-based exams.
- Per-question marks.
- Section marks.
- Negative marking.
- Optional partial credit.
- Server-authoritative timer.
- Autosave.
- Reconnect/resume.
- Previous/next navigation.
- Question palette.
- Mark for review.
- Answer change history.
- Fullscreen exam mode.
- Keyboard shortcuts.
- Submit confirmation.
- Auto-submit at deadline.
- Accident-submit protection.
- Accessibility mode.

Mobile exam UI:
- Sticky timer.
- Compact question navigator.
- Swipe-safe controls.
- Large touch targets.
- No viewport overflow.

## 9. Question authoring studio — Admin

Create a premium question studio with a split-pane layout where useful:
- Metadata panel.
- Prompt editor.
- Answer/grading panel.
- Preview panel.
- Validation panel.

Supported question types:
- MCQ.
- Multi-select.
- True/false.
- Short text.
- Numeric.
- SQL.
- Python.
- Excel.
- Generic code.
- Data engineering.
- Case study.
- Manual review.

Authoring features:
- Rich text/Markdown.
- Code blocks.
- Tables.
- Images.
- File attachments.
- Tags.
- Difficulty.
- Topic/subtopic.
- Learning objectives.
- Estimated time.
- Marks.
- Grading mode.
- Starter code.
- Test cases.
- SQL schema.
- Excel workbook fixtures.
- Explanation.
- Hints.
- Reference solution.
- Internal notes.

Answer keys and grader configuration stay server-side.

## 10. FAST question entry — Paste/write

Admin must have a "Quick Add / Paste Questions" mode.

Accept:
- Multi-row TSV copied from Excel/Google Sheets.
- CSV text.
- JSON array for power users.

Workflow:
1. Paste.
2. Detect headers/format.
3. Parse.
4. Validate every row.
5. Show row-by-row errors and warnings.
6. Detect duplicate IDs inside the paste.
7. Detect IDs already present in the database.
8. Preview.
9. Choose Draft / In review / Published.
10. Commit.
11. Record import batch and audit log.

Never partially publish invalid rows without making the skipped rows obvious.

## 11. Excel/CSV bulk question upload

Admin can:
- Drag/drop `.xlsx`, `.xls`, `.csv`.
- Browse files.
- Paste from spreadsheet.
- Download official template.
- Download import guide.
- Upload up to a documented maximum file size.
- Preview before save.
- Validate server-side.
- Detect duplicates.
- Detect existing question IDs.
- Show per-row status.
- Download error CSV.
- Retry only failed rows.
- Commit as draft/review/published.
- Record batch history.
- Roll back a batch when safe.

Importer must normalize headers so variants such as `Question Type`, `question_type`, and `QuestionType` map correctly.

Recommended columns:
- questionid
- program
- topic
- subtopic
- title
- question/prompt
- questiontype
- difficulty
- marks
- timelimitsec
- instructions
- choices
- answerkey
- gradingmode
- startercode
- graderconfig
- explanation
- tags
- status

## 12. Import history

Add `/admin/questions/imports`:
- Batch ID.
- Filename/source.
- Uploaded by.
- Timestamp.
- Row count.
- Valid.
- Errors.
- Target status.
- Commit status.
- Rollback action where available.
- Download error report.
- Open questions created/updated by batch.

## 13. Question lifecycle

State machine:
Draft → In Review → Approved → Published → Archived.

Track:
- Who changed it.
- When.
- Why/comment.
- Version number.
- Before/after snapshot.

Support:
- Version history.
- Compare versions.
- Restore version.
- Duplicate question.
- Archive.
- Bulk publish.
- Bulk archive.
- Bulk tag.
- Bulk difficulty update.

## 14. Quality control before publishing

Automated checks:
- Empty prompt.
- Missing answer key.
- Missing MCQ choices.
- Duplicate choices.
- Duplicate question ID.
- Excessively long prompt.
- Unsupported type.
- Invalid grader JSON.
- Missing test cases for code questions.
- Missing dataset for data questions.
- Impossible mark/time configuration.
- Suspicious answer leakage in explanation/prompt.
- Broken attachment references.

Add pre-publish test run.

For SQL/Python:
- Run sample solution.
- Run negative/edge cases.
- Run time limits.

For Excel:
- Evaluate formulas against fixture workbook.
- Verify expected output cells.

## 15. Assessment builder — Admin

Builder features:
- Drag/drop question ordering.
- Search question bank.
- Filter by topic/type/difficulty/tag.
- Add from pool.
- Random pool selection.
- Difficulty quotas.
- Section organization.
- Per-question mark/time override.
- Total marks preview.
- Estimated duration.
- Passing score.
- Attempt limit.
- Start/end schedule.
- Result release timing.
- Instructions.
- Assessment templates.
- Preview as student.

## 16. Assignment system — Admin

Assign assessments to:
- Individual users.
- Cohorts/batches.
- All users in a program.

Support:
- Due date.
- Time zone.
- Reminder schedule.
- Late policy.
- Maximum attempts.
- Result release policy.

## 17. Grading

Auto-grade where deterministic.

Manual review queue for case studies and open responses.

Admin reviewer experience:
- Question.
- Student answer.
- Expected answer/rubric.
- Award points.
- Feedback.
- Internal note.
- Save/next.

Never expose hidden answer keys to students before result release.

## 18. Student results

Results screen should show after release:
- Total score.
- Percentage.
- Pass/fail.
- Correct/incorrect/skipped.
- Time used.
- Time per question.
- Topic performance.
- Difficulty performance.
- Question-level review.
- Released explanations.
- Recommended next practice.

Add attempt history and comparison over time.

## 19. Analytics — Admin

Executive dashboard:
- DAU/WAU/MAU where appropriate.
- Active learners.
- Course completion.
- Assessment completion.
- Pass rate.
- Average score.
- Median score.
- Question success rate.
- Difficulty discrimination.
- Most missed questions.
- Most skipped questions.
- Time-per-question distribution.
- Drop-off points.
- Program performance.
- Cohort performance.
- Assessment performance.

Charts must be useful, filterable and exportable.

## 20. Student analytics

Show:
- Weekly goal.
- Streak.
- Practice volume.
- Score trend.
- Topic heatmap.
- Skill coverage.
- Time spent.
- Weak topics.
- Improvement trend.

Do not encourage unhealthy excessive-use mechanics; streaks are supportive, not coercive.

## 21. Gamification — optional but premium

Add only if the product strategy enables it:
- Streaks.
- XP.
- Achievements.
- Badges.
- Daily challenge.
- Skill milestones.
- Optional leaderboard with privacy controls.

Avoid manipulative notifications.

## 22. Certificates

On eligible completion:
- Generate certificate.
- Unique certificate ID.
- Verification page.
- Download PDF.
- Share link.
- Completion date.
- Program name.
- Learner name.

Admin can revoke a certificate with audit trail.

## 23. Notifications

Channels:
- In-app.
- Email.
- Web push where supported.

Types:
- New assignment.
- Reminder.
- Result released.
- Course published.
- Certificate earned.
- Security/login alert.

User preferences:
- Per-channel opt-in/out.
- Quiet hours.
- Timezone-aware scheduling.

## 24. Admin notifications

Admin should see:
- Failed imports.
- Questions awaiting review.
- Manual grading queue.
- Scheduled assessment reminders.
- System warnings.
- Integration failures.

## 25. Search

Global search:
- Courses.
- Programs.
- Lessons.
- Questions where authorized.
- Users for admin.

Admin search should support advanced filtering and saved views.

## 26. User profile/settings

Settings:
- Name.
- Avatar.
- Language.
- Timezone.
- Theme: system/light/dark.
- Email preferences.
- Push preferences.
- Password/security.
- Active sessions.
- Download my data.
- Delete account.

## 27. Admin settings

- Organization/platform name.
- Logo.
- Branding.
- Default language.
- Default timezone.
- Assessment defaults.
- Email provider settings.
- Storage settings.
- Execution runner status.
- Feature flags.
- Maintenance mode.
- Security policy.

Secrets never appear in client UI.

## 28. Global launch readiness

Internationalization:
- Language framework.
- Translation keys, never hardcoded UI copy in business logic.
- RTL-ready layout.

Localization:
- Date/time.
- Number formatting.
- Time zones.
- Decimal conventions.
- Calendar formatting.

Privacy/compliance:
- Privacy policy.
- Terms.
- Cookie/consent strategy where legally required.
- Data export.
- Account deletion.
- Audit records.
- Data retention policy.

Security:
- RLS.
- Least privilege.
- CSP.
- Secure headers.
- CSRF protection where relevant.
- Rate limiting.
- Abuse controls.
- Input sanitization.
- Upload validation.
- Malware/content validation where file uploads are enabled.
- Session revocation.
- Admin action audit.

## 29. Performance

Targets:
- Fast initial navigation.
- Server-render where useful.
- Avoid unnecessary client bundles.
- Lazy-load Monaco/code workspaces.
- Paginate admin tables.
- Virtualize very large tables.
- Cache read-heavy catalog data.
- Debounce search.
- Optimistic UI only when safe.
- Avoid large images without responsive sizing.

Use performance budgets in CI.

## 30. Reliability

Add:
- Global loading states.
- Error boundaries.
- Retry affordances.
- Reconnect handling during assessments.
- Autosave indicators.
- Idempotency for critical submissions and imports.
- Background jobs for email, reports and large exports.
- Health checks.
- Status page integration where available.

## 31. Observability

Integrate optional production tools:
- Sentry or equivalent error tracking.
- Structured server logs.
- Request IDs.
- Audit logs.
- Import batch logs.
- Execution logs.
- Security event logs.

Never log passwords, access tokens, answer keys or sensitive student answers unnecessarily.

## 32. Backups and exports

Support:
- Database backups.
- Question-bank export.
- Assessment export.
- Result export.
- User export where authorized.
- CSV/XLSX reports.
- PDF reports/certificates.

## 33. Admin UX details

Admin should be able to do common tasks in the fewest clicks:
- Add question.
- Paste questions.
- Upload Excel.
- Find existing question.
- Duplicate question.
- Edit.
- Test.
- Send to review.
- Publish.
- Build assessment.
- Assign assessment.
- Review results.

Use bulk action bars when multiple rows are selected.

Use drawers/modals for quick edits when they reduce context switching.

## 34. Student UX details

The student should always know:
- Where they are.
- What to do next.
- How much time remains.
- Whether their answer is saved.
- What their progress is.
- Why something is unavailable.

Avoid information overload. Prioritize the next action.

## 35. Mobile-first rules

Breakpoints must be tested at:
320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1440, 1920.

On mobile:
- Sidebar becomes drawer.
- Tables become cards or safely scroll.
- Exam controls become sticky/compact.
- Inputs stay above the keyboard where possible.
- No hover-only actions.
- Keep tap targets around 44px or larger.

## 36. PWA / installability

Provide:
- Web manifest.
- App icons.
- Standalone display mode.
- Theme color.
- Offline/error shell.

Do not pretend the entire assessment system works offline if the backend is unavailable. Offline support should preserve safe local UI state and recover gracefully.

## 37. Release gates

Before launch:

### Functional
- Every auth flow passes.
- Every protected route passes.
- User/admin boundaries pass.
- Import/upload/paste workflows pass.
- Question versioning passes.
- Assessment lifecycle passes.
- Grading passes.
- Results release passes.

### Security
- No client role escalation.
- No answer-key leakage.
- No grader-config leakage.
- No unsafe code execution.
- RLS policies tested.
- Admin mutations audited.

### Quality
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- E2E smoke tests.
- Mobile viewport test.
- Accessibility audit.
- Lighthouse/performance review.

### Production
- Environment variables documented.
- Supabase migrations ordered and tested.
- Vercel deployment documented.
- Runner deployment documented.
- Email sender configured.
- Storage configured.
- Error monitoring configured.
- Backups configured.
- Privacy/terms published.

## 38. Definition of done

Do not call SkillForge production-ready merely because screens look finished.

Production-ready means the end-to-end product works with real data, real authentication, real authorization, real imports, real grading, real auditability, safe execution, responsive UX, accessibility, performance and operational controls.

When a feature is not configured because an external provider is required, the UI must clearly show a safe setup state and the docs must name the exact environment variables and configuration steps. Never hide an unconfigured integration behind a fake success screen.
