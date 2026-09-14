# SkillForge — Global Launch Enhancement

## Added in this package

### Premium UX
- Mobile drawer navigation in the shared AppShell.
- Richer sticky header with compact global-search affordance.
- Premium surface/glow/focus utilities.
- Reduced-motion handling.
- Global loading skeleton.
- Global error boundary with retry action.

### Admin question operations
- Excel/XLS/CSV bulk import retained and enhanced.
- Server-side existing-question detection during preview.
- Direct TSV/CSV paste workflow for fast question entry.
- Paste validation uses the same server-side schema as file imports.
- Import preview shows existing IDs and in-file duplicates.
- Downloadable CSV error report for invalid rows.
- Downloadable paste guide and official import template.

### Global launch foundation
- Web app manifest.
- Installable SVG app icons.
- Global product build contract covering localization, analytics, notifications, certification, privacy, security, accessibility, performance, observability, backups and release gates.

## Verification performed

- All 87 TS/TSX files were parsed with TypeScript 5.8.3 transpilation diagnostics: no syntax errors.
- Full `npm run verify` could not be executed because the environment could not finish installing the complete npm dependency tree; this is an environment limitation, not a claim of a clean production build.
