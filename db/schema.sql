create extension if not exists pgcrypto;

create type public.user_role as enum ('user','admin');
create type public.difficulty as enum ('easy','medium','hard');
create type public.question_type as enum ('mcq','multi_select','true_false','text','numeric','sql','python','excel','code','data_engineering','case_study','manual_review');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'user',
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programs (
  id text primary key, slug text unique not null, name text not null, description text not null default '',
  icon text not null default 'book', status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table public.questions (
  id text primary key, program_id text not null references public.programs(id), topic text not null, subtopic text, topic_id uuid,
  title text not null, prompt text not null, question_type public.question_type not null, difficulty public.difficulty not null,
  marks integer not null default 5 check (marks > 0), time_limit_sec integer not null default 180 check (time_limit_sec > 0),
  instructions text not null default '', dataset_id text, starter_code text, choices jsonb, tags jsonb not null default '[]'::jsonb,
  answer_key text, grading_mode text not null default 'exact', grader_config jsonb not null default '{}'::jsonb,
  explanation text, status text not null default 'published' check (status in ('draft','in_review','published','archived')),
  version integer not null default 1, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.assessments (
  id text primary key, name text not null, description text not null default '', program_id text not null references public.programs(id),
  duration_sec integer not null check (duration_sec > 0), passing_score numeric(5,2) not null default 0,
  max_attempts integer not null default 0, randomize_questions boolean not null default false, randomize_options boolean not null default false,
  start_date timestamptz, end_date timestamptz, published boolean not null default false,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);

create table public.assessment_questions (
  assessment_id text not null references public.assessments(id) on delete cascade,
  question_id text not null references public.questions(id), position integer not null,
  marks_override integer check (marks_override is null or marks_override > 0),
  time_limit_override_sec integer check (time_limit_override_sec is null or time_limit_override_sec > 0),
  primary key (assessment_id, question_id), unique (assessment_id, position)
);

create table public.assessment_assignments (
  assessment_id text not null references public.assessments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, assigned_at timestamptz not null default now(),
  primary key (assessment_id, user_id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(), assessment_id text not null references public.assessments(id), user_id uuid not null references public.profiles(id),
  started_at timestamptz not null default now(), submitted_at timestamptz, duration_sec integer not null default 0,
  score numeric(10,2) not null default 0, max_score numeric(10,2) not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','auto_graded','under_review','approved','released')),
  question_order jsonb not null default '[]'::jsonb, last_activity_at timestamptz not null default now(), result_released_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.attempt_question_snapshots (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id text not null, question_version integer not null, question_snapshot jsonb not null,
  answer_key_snapshot text, grader_config_snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id text not null, answer text not null default '', is_correct boolean, score numeric(10,2) not null default 0,
  time_spent_sec integer not null default 0, feedback text, admin_comment text, reviewed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(attempt_id, question_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id) on delete set null,
  action text not null, entity text not null, entity_id text, old_value jsonb, new_value jsonb, created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key, user_id uuid references public.profiles(id) on delete set null,
  attempt_id uuid references public.attempts(id) on delete set null, action text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id, full_name) values(new.id, coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.questions enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_question_snapshots enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.audit_logs enable row level security;
alter table public.activity_logs enable row level security;

create policy "profiles_self_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "programs_read" on public.programs for select using (status = 'active' or public.is_admin());
create policy "programs_admin_write" on public.programs for all using (public.is_admin()) with check (public.is_admin());
create policy "questions_admin_only" on public.questions for all using (public.is_admin()) with check (public.is_admin());
create policy "assessments_read" on public.assessments for select using (published = true or public.is_admin());
create policy "assessments_admin_write" on public.assessments for all using (public.is_admin()) with check (public.is_admin());
create policy "assessment_questions_read" on public.assessment_questions for select using (exists(select 1 from public.assessments a where a.id=assessment_id and (a.published=true or public.is_admin())));
create policy "assessment_questions_admin_write" on public.assessment_questions for all using (public.is_admin()) with check (public.is_admin());
create policy "assignments_self_or_admin" on public.assessment_assignments for select using (user_id=auth.uid() or public.is_admin());
create policy "assignments_admin_write" on public.assessment_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy "attempts_self_read" on public.attempts for select using (user_id=auth.uid() or public.is_admin());
create policy "attempts_self_insert" on public.attempts for insert with check (user_id=auth.uid());
create policy "attempts_admin_update" on public.attempts for update using (public.is_admin()) with check (public.is_admin());
create policy "snapshots_admin_only" on public.attempt_question_snapshots for all using (public.is_admin()) with check (public.is_admin());
create policy "answers_admin_read" on public.attempt_answers for select using (public.is_admin());
create policy "answers_self_insert_active" on public.attempt_answers for insert with check (exists(select 1 from public.attempts a where a.id=attempt_id and a.user_id=auth.uid() and a.status='in_progress'));
create policy "answers_self_update_active" on public.attempt_answers for update using (exists(select 1 from public.attempts a where a.id=attempt_id and a.user_id=auth.uid() and a.status='in_progress')) with check (exists(select 1 from public.attempts a where a.id=attempt_id and a.user_id=auth.uid() and a.status='in_progress'));
create policy "audit_admin_only" on public.audit_logs for all using (public.is_admin()) with check (public.is_admin());
create policy "activity_self_read" on public.activity_logs for select using (user_id=auth.uid() or public.is_admin());
create policy "activity_self_insert" on public.activity_logs for insert with check (user_id=auth.uid() or public.is_admin());

create index idx_questions_program_topic on public.questions(program_id, topic);
create index idx_questions_status on public.questions(status);
create index idx_attempts_user_status on public.attempts(user_id, status);
create index idx_attempts_assessment on public.attempts(assessment_id);
create index idx_answers_attempt_question on public.attempt_answers(attempt_id, question_id);
create index idx_assignments_user on public.assessment_assignments(user_id, assessment_id);


-- Production additions (also available as db/migrations/002_production_pass.sql)
-- SkillForge production pass: topics, account status, atomic attempt start, stronger indexes/RLS.
alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active','disabled'));
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references public.programs(id) on delete cascade,
  parent_id uuid references public.topics(id) on delete set null,
  name text not null,
  slug text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, slug)
);
create index if not exists idx_topics_program_parent on public.topics(program_id,parent_id);
create index if not exists idx_attempts_user_assessment_status on public.attempts(user_id,assessment_id,status);
create index if not exists idx_attempt_answers_attempt_review on public.attempt_answers(attempt_id,reviewed);
create index if not exists idx_activity_user_created on public.activity_logs(user_id,created_at desc);

alter table public.topics enable row level security;
drop policy if exists topics_read on public.topics;
drop policy if exists topics_admin_write on public.topics;
create policy topics_read on public.topics for select using (status='active' or public.is_admin());
create policy topics_admin_write on public.topics for all using (public.is_admin()) with check (public.is_admin());

-- A single transaction owns the max-attempt and active-attempt checks.
create or replace function public.start_attempt_atomic(p_assessment_id text, p_user_id uuid, p_question_order jsonb, p_max_score numeric)
returns table(attempt_id uuid, started_at timestamptz, resumed boolean)
language plpgsql security definer set search_path=public as $$
declare
  a attempts%rowtype;
  max_a integer;
  total integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_assessment_id || ':' || p_user_id::text));
  select * into a from attempts where assessment_id=p_assessment_id and user_id=p_user_id and status='in_progress' limit 1;
  if a.id is not null then return query select a.id,a.started_at,true; return; end if;
  select coalesce(max_attempts,0) into max_a from assessments where id=p_assessment_id for update;
  select count(*) into total from attempts where assessment_id=p_assessment_id and user_id=p_user_id;
  if max_a > 0 and total >= max_a then raise exception 'MAX_ATTEMPTS'; end if;
  insert into attempts(assessment_id,user_id,max_score,status,question_order) values(p_assessment_id,p_user_id,p_max_score,'in_progress',p_question_order) returning * into a;
  return query select a.id,a.started_at,false;
end; $$;

revoke all on function public.start_attempt_atomic(text,uuid,jsonb,numeric) from public;

-- Final production hardening is included here; existing databases can use db/migrations/003_production_hardening.sql.
-- SkillForge production hardening.
alter table public.attempt_answers add column if not exists grading_status text not null default 'completed' check (grading_status in ('pending','running','completed','failed','manual_review'));
alter table public.attempt_answers add column if not exists requires_review boolean not null default false;
create index if not exists idx_answers_attempt_grading on public.attempt_answers(attempt_id,grading_status,requires_review);

create or replace function public.save_assessment_atomic(p_assessment jsonb, p_questions jsonb, p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into assessments(id,name,description,program_id,duration_sec,passing_score,max_attempts,randomize_questions,randomize_options,start_date,end_date,published,created_by)
  values((p_assessment->>'id'),p_assessment->>'name',coalesce(p_assessment->>'description',''),p_assessment->>'programId',(p_assessment->>'durationSec')::int,(p_assessment->>'passingScore')::numeric,(p_assessment->>'maxAttempts')::int,coalesce((p_assessment->>'randomizeQuestions')::boolean,false),coalesce((p_assessment->>'randomizeOptions')::boolean,false),nullif(p_assessment->>'startDate','')::timestamptz,nullif(p_assessment->>'endDate','')::timestamptz,coalesce((p_assessment->>'published')::boolean,false),p_actor)
  on conflict (id) do update set name=excluded.name,description=excluded.description,program_id=excluded.program_id,duration_sec=excluded.duration_sec,passing_score=excluded.passing_score,max_attempts=excluded.max_attempts,randomize_questions=excluded.randomize_questions,randomize_options=excluded.randomize_options,start_date=excluded.start_date,end_date=excluded.end_date,published=excluded.published;
  delete from assessment_questions where assessment_id=p_assessment->>'id';
  insert into assessment_questions(assessment_id,question_id,position,marks_override,time_limit_override_sec)
  select p_assessment->>'id',x->>'questionId',(x->>'position')::int,nullif(x->>'marksOverride','')::int,nullif(x->>'timeLimitOverrideSec','')::int from jsonb_array_elements(p_questions) x;
end; $$;
revoke all on function public.save_assessment_atomic(jsonb,jsonb,uuid) from public;

create table if not exists public.question_versions (
  id bigint generated always as identity primary key,
  question_id text not null references public.questions(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(question_id,version)
);
alter table public.question_versions enable row level security;
drop policy if exists question_versions_admin on public.question_versions;
create policy question_versions_admin on public.question_versions for all using (public.is_admin()) with check (public.is_admin());



-- Bulk question import audit trail (Excel/XLS/CSV or pasted TSV).
create table if not exists public.question_import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  uploaded_by uuid not null references auth.users(id),
  row_count integer not null default 0,
  valid_count integer not null default 0,
  error_count integer not null default 0,
  target_status text not null default 'draft' check (target_status in ('draft','in_review','published')),
  status text not null default 'pending' check (status in ('pending','committed','discarded')),
  question_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  committed_at timestamptz
);
create index if not exists idx_import_batches_uploaded_by on public.question_import_batches(uploaded_by);
alter table public.question_import_batches enable row level security;
drop policy if exists admin_manage_import_batches on public.question_import_batches;
create policy admin_manage_import_batches on public.question_import_batches for all using (public.is_admin()) with check (public.is_admin());
