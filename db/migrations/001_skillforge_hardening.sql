-- Apply after the original schema.sql on an existing Supabase project.
create extension if not exists pgcrypto;

alter type public.question_type add value if not exists 'multi_select';
alter type public.question_type add value if not exists 'true_false';
alter type public.question_type add value if not exists 'code';
alter type public.question_type add value if not exists 'data_engineering';
alter type public.question_type add value if not exists 'case_study';
alter type public.question_type add value if not exists 'manual_review';

alter table public.programs add column if not exists status text not null default 'active' check (status in ('active','archived'));
alter table public.questions add column if not exists subtopic text;
alter table public.questions add column if not exists instructions text not null default '';
alter table public.questions add column if not exists dataset_id text;
alter table public.questions add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.questions add column if not exists grading_mode text not null default 'exact';
alter table public.questions add column if not exists explanation text;
alter table public.questions add column if not exists status text not null default 'published' check (status in ('draft','published','archived'));
alter table public.questions add column if not exists version integer not null default 1;

alter table public.assessments add column if not exists passing_score numeric(5,2) not null default 0;
alter table public.assessments add column if not exists max_attempts integer not null default 0;
alter table public.assessments add column if not exists randomize_questions boolean not null default false;
alter table public.assessments add column if not exists randomize_options boolean not null default false;
alter table public.assessments add column if not exists start_date timestamptz;
alter table public.assessments add column if not exists end_date timestamptz;

alter table public.attempts alter column score type numeric(10,2) using score::numeric;
alter table public.attempts alter column max_score type numeric(10,2) using max_score::numeric;
alter table public.attempts drop constraint if exists attempts_status_check;
alter table public.attempts add constraint attempts_status_check check (status in ('in_progress','submitted','auto_graded','under_review','approved','released'));
alter table public.attempts add column if not exists question_order jsonb not null default '[]'::jsonb;
alter table public.attempts add column if not exists last_activity_at timestamptz not null default now();

create table if not exists public.attempt_question_snapshots (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id text not null,
  question_version integer not null,
  question_snapshot jsonb not null,
  answer_key_snapshot text,
  grader_config_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

alter table public.attempt_question_snapshots enable row level security;
create policy "attempt_question_snapshots_admin_only" on public.attempt_question_snapshots for all using (public.is_admin()) with check (public.is_admin());

-- Users must never query the raw question table because it contains answer_key.
drop policy if exists "questions_auth_read" on public.questions;
create policy "questions_admin_only" on public.questions for all using (public.is_admin()) with check (public.is_admin());

-- Historical attempt answers are user-readable only through explicitly safe server code.
drop policy if exists "answers_self_or_admin" on public.attempt_answers;
create policy "answers_admin_only" on public.attempt_answers for select using (public.is_admin());

-- A user can create/update their own answers only while their attempt is active.
drop policy if exists "answers_self_write" on public.attempt_answers;
create policy "answers_self_insert_active" on public.attempt_answers for insert with check (
  exists(select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid() and a.status = 'in_progress')
);
drop policy if exists "answers_self_update_or_admin" on public.attempt_answers;
create policy "answers_self_update_active" on public.attempt_answers for update using (
  exists(select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid() and a.status = 'in_progress')
) with check (
  exists(select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid() and a.status = 'in_progress')
);

create index if not exists idx_questions_program_topic on public.questions(program_id, topic);
create index if not exists idx_questions_status on public.questions(status);
create index if not exists idx_attempts_user_status on public.attempts(user_id, status);
create index if not exists idx_attempts_assessment on public.attempts(assessment_id);
create index if not exists idx_answers_attempt_question on public.attempt_answers(attempt_id, question_id);
create index if not exists idx_assignments_user on public.assessment_assignments(user_id, assessment_id);

-- Only admins can update attempt score/status/release directly.
drop policy if exists "attempts_self_update_or_admin" on public.attempts;
create policy "attempts_admin_update" on public.attempts for update using (public.is_admin()) with check (public.is_admin());
