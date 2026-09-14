# SkillForge Feature Matrix

This package contains both implemented foundation work and the master build contract.

## Implemented in this package

- Premium UI polish: focus states, reduced-motion support, luxury surfaces, subtle depth and motion.
- Responsive AppShell with mobile drawer navigation.
- Global loading and error boundaries.
- Installable PWA manifest and icons.
- Admin Excel/XLS/CSV question import.
- Server-side import validation.
- Existing-ID detection during preview.
- In-file duplicate detection.
- Direct paste importer for TSV/CSV-style spreadsheet content.
- Downloadable import template.
- Downloadable row-level CSV error report.
- Draft / in-review / published import target.
- Question versioning foundation already present in the project.

## Already present in the project and retained

- Supabase Auth/PostgreSQL/RLS foundation.
- Admin and user route separation.
- Question bank.
- Question version table.
- Assessment builder foundation.
- Attempts and answer snapshots.
- Server-authoritative assessment timing foundation.
- SQL/Python execution runner boundary.
- Admin analytics foundation.
- Practice and result flows.

## Required next production layer from the master prompt

- First-login onboarding and localization.
- Full notification center and preferences.
- Advanced question studio with richer authoring and test-case UX.
- Import history/rollback UI.
- Cohorts/batches and richer assignment scheduling.
- Certificate generation/verification.
- Global privacy/compliance surfaces.
- Full feature-flag/settings center.
- Expanded analytics and export center.
- E2E regression suite for all release gates.

The master prompt is intentionally explicit so a coding agent can implement the remaining feature set without silently dropping requirements.
