# SkillForge Production Feature Pack

This package adds the complete product specification for the requested Admin and Student feature set.

## Admin flow
Excel/CSV upload -> validation -> preview -> draft -> review -> test -> publish -> analytics.

## Student flow
Auto-save -> timer -> recovery -> code execution -> navigation -> submission -> result analytics.

## Security
Answer keys and grader configuration must remain server-side. Python/SQL execution must run on a dedicated isolated execution service with no Supabase/service-role credentials.

The `docs/production-feature-spec.json` file is the implementation contract for the feature set.
