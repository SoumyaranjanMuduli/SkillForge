create extension if not exists pgcrypto;

-- SETUP PATH: fresh Supabase project -> run this file alone, nothing in db/migrations/.
-- db/migrations/001-009 exist only to upgrade an older, already-live database that
-- predates this consolidated schema; do not run them after this file.
create type public.user_role as enum ('user','admin');
create type public.difficulty as enum ('easy','medium','hard');
create type public.question_type as enum ('mcq','multi_select','true_false','text','numeric','sql','python','excel','code','data_engineering','case_study','manual_review');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'user',
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  age integer check (age is null or (age between 13 and 100)),
  gender text,
  birth_year integer check (birth_year is null or (birth_year between 1900 and 2100)),
  onboarding_complete boolean not null default false
);

create table public.programs (
  id text primary key, slug text unique not null, name text not null, description text not null default '',
  icon text not null default 'book', status text not null default 'active' check (status in ('active','archived')),
  notes text not null default '',
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

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null default '',
  type text not null default 'info' check (type in ('info','assessment','result','admin','system')),
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
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
alter table public.notifications enable row level security;

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
create policy "attempts_admin_update" on public.attempts for update using (public.is_admin()) with check (public.is_admin());
create policy "snapshots_admin_only" on public.attempt_question_snapshots for all using (public.is_admin()) with check (public.is_admin());
create policy "answers_admin_read" on public.attempt_answers for select using (public.is_admin());
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

-- SkillForge production hardening: make assessment start + snapshot creation and answer save atomic.
-- Existing databases: apply after migrations 001-008.

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

create or replace function public.start_attempt_with_snapshots(
  p_assessment_id text,
  p_user_id uuid,
  p_question_order jsonb,
  p_max_score numeric,
  p_snapshots jsonb
)
returns table(attempt_id uuid, started_at timestamptz, resumed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  a attempts%rowtype;
  max_a integer;
  total integer;
  snapshot_count integer;
  order_count integer;
begin
  if jsonb_typeof(p_question_order) <> 'array' then raise exception 'INVALID_QUESTION_ORDER'; end if;
  if jsonb_typeof(p_snapshots) <> 'array' then raise exception 'INVALID_SNAPSHOTS'; end if;
  order_count := jsonb_array_length(p_question_order);
  snapshot_count := jsonb_array_length(p_snapshots);
  if order_count < 1 or order_count > 500 then raise exception 'INVALID_QUESTION_COUNT'; end if;
  if snapshot_count <> order_count then raise exception 'SNAPSHOT_COUNT_MISMATCH'; end if;
  if p_max_score < 0 or p_max_score > 500000 then raise exception 'INVALID_MAX_SCORE'; end if;

  perform pg_advisory_xact_lock(hashtext(p_assessment_id || ':' || p_user_id::text));

  select * into a
  from attempts
  where assessment_id = p_assessment_id and user_id = p_user_id and status = 'in_progress'
  order by started_at desc
  limit 1;
  if a.id is not null then
    return query select a.id, a.started_at, true;
    return;
  end if;

  select coalesce(max_attempts, 0) into max_a
  from assessments
  where id = p_assessment_id
  for update;
  if not found then raise exception 'ASSESSMENT_NOT_FOUND'; end if;

  select count(*) into total from attempts where assessment_id = p_assessment_id and user_id = p_user_id;
  if max_a > 0 and total >= max_a then raise exception 'MAX_ATTEMPTS'; end if;

  insert into attempts(assessment_id,user_id,max_score,status,question_order)
  values(p_assessment_id,p_user_id,p_max_score,'in_progress',p_question_order)
  returning * into a;

  insert into attempt_question_snapshots(
    attempt_id, question_id, question_version, question_snapshot, answer_key_snapshot, grader_config_snapshot
  )
  select
    a.id,
    x->>'questionId',
    coalesce(nullif(x->>'questionVersion','')::integer, 1),
    coalesce(x->'questionSnapshot', '{}'::jsonb),
    nullif(x->>'answerKeySnapshot',''),
    coalesce(x->'graderConfigSnapshot', '{}'::jsonb)
  from jsonb_array_elements(p_snapshots) x;

  if (select count(*) from attempt_question_snapshots where attempt_id = a.id) <> order_count then
    raise exception 'SNAPSHOT_INSERT_FAILED';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_question_order) qid
    where not exists (
      select 1 from attempt_question_snapshots s where s.attempt_id = a.id and s.question_id = qid
    )
  ) then
    raise exception 'QUESTION_ORDER_MISMATCH';
  end if;

  return query select a.id, a.started_at, false;
end;
$$;

create or replace function public.save_attempt_answer_atomic(
  p_attempt_id uuid,
  p_user_id uuid,
  p_question_id text,
  p_answer text,
  p_time_spent_sec integer
)
returns table(saved_at timestamptz, server_elapsed_sec integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt attempts%rowtype;
  v_duration integer;
  v_elapsed integer;
  v_now timestamptz := now();
begin
  if p_question_id is null or length(trim(p_question_id)) = 0 then raise exception 'INVALID_QUESTION'; end if;
  if p_answer is null or length(p_answer) > 200000 then raise exception 'ANSWER_TOO_LARGE'; end if;
  if p_time_spent_sec < 0 or p_time_spent_sec > 86400 then raise exception 'INVALID_TIME'; end if;

  select * into v_attempt
  from attempts
  where id = p_attempt_id and user_id = p_user_id
  for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'ATTEMPT_NOT_ACTIVE'; end if;

  select duration_sec into v_duration from assessments where id = v_attempt.assessment_id;
  if v_duration is null then raise exception 'ASSESSMENT_NOT_FOUND'; end if;
  v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_attempt.started_at)))::integer);
  if v_elapsed >= v_duration then raise exception 'ATTEMPT_EXPIRED'; end if;

  if not exists (
    select 1 from attempt_question_snapshots
    where attempt_id = p_attempt_id and question_id = p_question_id
  ) then
    raise exception 'QUESTION_NOT_IN_ATTEMPT';
  end if;

  insert into attempt_answers(attempt_id,question_id,answer,time_spent_sec,updated_at)
  values(p_attempt_id,p_question_id,p_answer,least(p_time_spent_sec,v_elapsed),v_now)
  on conflict (attempt_id,question_id) do update set
    answer = excluded.answer,
    time_spent_sec = excluded.time_spent_sec,
    updated_at = excluded.updated_at;

  update attempts set last_activity_at = v_now where id = p_attempt_id;
  insert into activity_logs(user_id,attempt_id,action,metadata)
  values(p_user_id,p_attempt_id,'answer_saved',jsonb_build_object('questionId',p_question_id,'timeSpentSec',least(p_time_spent_sec,v_elapsed)));

  return query select v_now, v_elapsed;
end;
$$;

revoke all on function public.start_attempt_with_snapshots(text,uuid,jsonb,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.start_attempt_with_snapshots(text,uuid,jsonb,numeric,jsonb) to service_role;
revoke all on function public.save_attempt_answer_atomic(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.save_attempt_answer_atomic(uuid,uuid,text,text,integer) to service_role;


create or replace function public.upsert_questions_atomic(p_rows jsonb, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  old_row questions%rowtype;
  next_version integer;
  count_rows integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_ROWS'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'TOO_MANY_ROWS'; end if;
  for row_data in select * from jsonb_array_elements(p_rows) loop
    if coalesce(length(row_data->>'id'), 0) < 2 then raise exception 'INVALID_QUESTION_ID'; end if;
    select * into old_row from questions where id = row_data->>'id' for update;
    next_version := coalesce(old_row.version, 0) + 1;
    if found then
      insert into question_versions(question_id,version,snapshot,created_by)
      values(old_row.id,old_row.version,to_jsonb(old_row),p_actor)
      on conflict (question_id,version) do nothing;
    end if;
    insert into questions(
      id,program_id,topic,topic_id,subtopic,title,prompt,question_type,difficulty,marks,time_limit_sec,
      instructions,starter_code,choices,answer_key,grader_config,grading_mode,explanation,status,version,created_by,updated_at
    ) values (
      row_data->>'id', row_data->>'program_id', row_data->>'topic', nullif(row_data->>'topic_id','')::uuid,
      nullif(row_data->>'subtopic',''), row_data->>'title', row_data->>'prompt', (row_data->>'question_type')::question_type,
      (row_data->>'difficulty')::difficulty, (row_data->>'marks')::integer, (row_data->>'time_limit_sec')::integer,
      coalesce(row_data->>'instructions',''), nullif(row_data->>'starter_code',''),
      case when row_data ? 'choices' then row_data->'choices' else null end,
      case when row_data ? 'answer_key' then nullif(row_data->>'answer_key','') else null end,
      coalesce(row_data->'grader_config','{}'::jsonb), coalesce(nullif(row_data->>'grading_mode',''),'exact'),
      case when row_data ? 'explanation' then nullif(row_data->>'explanation','') else null end,
      coalesce(nullif(row_data->>'status',''),'draft'), next_version, p_actor, now()
    )
    on conflict (id) do update set
      program_id=excluded.program_id, topic=excluded.topic, topic_id=excluded.topic_id, subtopic=excluded.subtopic,
      title=excluded.title, prompt=excluded.prompt, question_type=excluded.question_type, difficulty=excluded.difficulty,
      marks=excluded.marks, time_limit_sec=excluded.time_limit_sec, instructions=excluded.instructions,
      starter_code=excluded.starter_code, choices=excluded.choices, answer_key=excluded.answer_key,
      grader_config=excluded.grader_config, grading_mode=excluded.grading_mode, explanation=excluded.explanation,
      status=excluded.status, version=excluded.version, updated_at=now();
    insert into audit_logs(actor_id,action,entity,entity_id,new_value)
    values(p_actor,'upsert_question','question',row_data->>'id',jsonb_build_object('version',next_version));
    count_rows := count_rows + 1;
  end loop;
  return count_rows;
end;
$$;

create or replace function public.update_question_atomic(p_question jsonb, p_actor uuid, p_expected_version integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row questions%rowtype;
  next_version integer;
  new_status text;
begin
  select * into old_row from questions where id = p_question->>'id' for update;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  if old_row.version <> p_expected_version then raise exception 'QUESTION_MODIFIED'; end if;
  next_version := old_row.version + 1;
  new_status := case when p_question ? 'status' then p_question->>'status' else old_row.status end;

  insert into question_versions(question_id,version,snapshot,created_by)
  values(old_row.id,old_row.version,to_jsonb(old_row),p_actor)
  on conflict (question_id,version) do nothing;

  update questions set
    program_id = case when p_question ? 'program_id' then p_question->>'program_id' else program_id end,
    topic_id = case when p_question ? 'topic_id' and p_question->>'topic_id' is null then null when p_question ? 'topic_id' then (p_question->>'topic_id')::uuid else topic_id end,
    topic = case when p_question ? 'topic' then p_question->>'topic' else topic end,
    subtopic = case when p_question ? 'subtopic' and p_question->>'subtopic' is null then null when p_question ? 'subtopic' then p_question->>'subtopic' else subtopic end,
    title = case when p_question ? 'title' then p_question->>'title' else title end,
    prompt = case when p_question ? 'prompt' then p_question->>'prompt' else prompt end,
    question_type = case when p_question ? 'question_type' then (p_question->>'question_type')::question_type else question_type end,
    difficulty = case when p_question ? 'difficulty' then (p_question->>'difficulty')::difficulty else difficulty end,
    marks = case when p_question ? 'marks' then (p_question->>'marks')::integer else marks end,
    time_limit_sec = case when p_question ? 'time_limit_sec' then (p_question->>'time_limit_sec')::integer else time_limit_sec end,
    instructions = case when p_question ? 'instructions' then coalesce(p_question->>'instructions','') else instructions end,
    starter_code = case when p_question ? 'starter_code' and p_question->>'starter_code' is null then null when p_question ? 'starter_code' then p_question->>'starter_code' else starter_code end,
    choices = case when p_question ? 'choices' then p_question->'choices' else choices end,
    answer_key = case when p_question ? 'answer_key' and p_question->>'answer_key' is null then null when p_question ? 'answer_key' then p_question->>'answer_key' else answer_key end,
    grader_config = case when p_question ? 'grader_config' then coalesce(p_question->'grader_config','{}'::jsonb) else grader_config end,
    grading_mode = case when p_question ? 'grading_mode' then coalesce(p_question->>'grading_mode','exact') else grading_mode end,
    explanation = case when p_question ? 'explanation' and p_question->>'explanation' is null then null when p_question ? 'explanation' then p_question->>'explanation' else explanation end,
    status = new_status,
    version = next_version,
    updated_at = now()
  where id = old_row.id and version = p_expected_version;
  if not found then raise exception 'QUESTION_MODIFIED'; end if;
  insert into audit_logs(actor_id,action,entity,entity_id,new_value)
  values(p_actor,'update_question','question',old_row.id,jsonb_build_object('version',next_version));
  return next_version;
end;
$$;

revoke all on function public.upsert_questions_atomic(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.upsert_questions_atomic(jsonb,uuid) to service_role;
revoke all on function public.update_question_atomic(jsonb,uuid,integer) from public, anon, authenticated;
grant execute on function public.update_question_atomic(jsonb,uuid,integer) to service_role;

-- Default privileges and SECURITY DEFINER function grants are intentionally
-- explicit. The server-side service-role client is the only caller for write
-- RPCs; is_admin is a read-only helper for RLS policy evaluation.
revoke all on function public.handle_new_user() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke all on function public.start_attempt_atomic(text,uuid,jsonb,numeric) from public, anon, authenticated;
grant execute on function public.start_attempt_atomic(text,uuid,jsonb,numeric) to service_role;
revoke all on function public.save_assessment_atomic(jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_assessment_atomic(jsonb,jsonb,uuid) to service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public;


-- Final security hardening. Students can read their own attempt state but all attempt/answer
-- mutations go through authenticated server-side RPCs so state cannot be forged from a browser.
revoke insert, update, delete on public.attempts from anon, authenticated;
revoke insert, update, delete on public.attempt_answers from anon, authenticated;

create or replace function public.finalize_attempt_atomic(
  p_attempt_id uuid,
  p_user_id uuid,
  p_status text,
  p_submitted_at timestamptz,
  p_duration_sec integer,
  p_score numeric,
  p_updates jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt attempts%rowtype;
  item jsonb;
begin
  if p_status not in ('auto_graded','under_review') then raise exception 'INVALID_FINAL_STATUS'; end if;
  select * into v_attempt from attempts where id=p_attempt_id and user_id=p_user_id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.status <> 'submitted' then raise exception 'ATTEMPT_NOT_SUBMITTED'; end if;
  if p_duration_sec < 0 then raise exception 'INVALID_DURATION'; end if;
  if p_score < 0 or p_score > v_attempt.max_score then raise exception 'INVALID_SCORE'; end if;
  if jsonb_typeof(p_updates) <> 'array' then raise exception 'INVALID_UPDATES'; end if;

  for item in select * from jsonb_array_elements(p_updates) loop
    update attempt_answers
    set is_correct=(item->>'isCorrect')::boolean,
        score=(item->>'score')::numeric,
        feedback=item->>'feedback',
        grading_status=coalesce(item->>'gradingStatus','completed'),
        requires_review=coalesce((item->>'requiresReview')::boolean,false),
        updated_at=now()
    where attempt_id=p_attempt_id and question_id=item->>'questionId';

    if not found then
      insert into attempt_answers(
        attempt_id,question_id,answer,is_correct,score,feedback,time_spent_sec,grading_status,requires_review
      ) values (
        p_attempt_id,item->>'questionId',coalesce(item->>'answer',''),
        (item->>'isCorrect')::boolean,(item->>'score')::numeric,item->>'feedback',
        coalesce((item->>'timeSpentSec')::integer,0),coalesce(item->>'gradingStatus','completed'),
        coalesce((item->>'requiresReview')::boolean,false)
      );
    end if;
  end loop;

  update attempts
  set submitted_at=p_submitted_at,duration_sec=p_duration_sec,score=p_score,status=p_status,last_activity_at=now()
  where id=p_attempt_id and status='submitted';
  return true;
end;
$$;

revoke all on function public.finalize_attempt_atomic(uuid,uuid,text,timestamptz,integer,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_attempt_atomic(uuid,uuid,text,timestamptz,integer,numeric,jsonb) to service_role;

create or replace function public.validate_question_grading_config()
returns trigger language plpgsql as $$
declare mode text; tests jsonb;
begin
  mode := lower(coalesce(new.grading_mode,'exact'));
  if new.question_type in ('mcq','true_false','multi_select','text','numeric') and mode <> 'manual'
     and (new.answer_key is null or btrim(new.answer_key)='') then
    raise exception 'AUTO_GRADED_QUESTION_REQUIRES_ANSWER_KEY';
  end if;
  if new.question_type in ('python','sql','code') and mode <> 'manual' then
    tests := new.grader_config->'tests';
    if tests is null or jsonb_typeof(tests) <> 'array' or jsonb_array_length(tests)=0 then
      raise exception 'EXECUTABLE_QUESTION_REQUIRES_TESTS';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_validate_question_grading_config on public.questions;
create trigger trg_validate_question_grading_config before insert or update on public.questions
for each row execute function public.validate_question_grading_config();


-- Atomic question import: version history, question upserts, batch record and audit
-- entries either all commit or all roll back. This function is service-role only.
create or replace function public.commit_question_import_atomic(
  p_filename text,
  p_target_status text,
  p_rows jsonb,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_row jsonb;
  v_existing questions%rowtype;
  v_version integer;
  v_id text;
  v_status text;
begin
  if p_target_status not in ('draft', 'in_review', 'published') then
    raise exception 'INVALID_TARGET_STATUS';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 1 then
    raise exception 'INVALID_IMPORT_ROWS';
  end if;

  insert into question_import_batches (
    filename, uploaded_by, row_count, valid_count, error_count,
    target_status, status, question_ids, committed_at
  ) values (
    p_filename, p_actor, jsonb_array_length(p_rows), jsonb_array_length(p_rows), 0,
    p_target_status, 'committed', '{}', now()
  ) returning id into v_batch_id;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_id := v_row->>'id';
    if v_id is null or btrim(v_id) = '' then
      raise exception 'INVALID_QUESTION_ID';
    end if;

    select * into v_existing from questions where id = v_id for update;
    v_version := coalesce(v_existing.version, 0) + 1;

    if found then
      insert into question_versions(question_id, version, snapshot, created_by)
      values(v_existing.id, v_existing.version, to_jsonb(v_existing), p_actor);
    end if;

    v_status := coalesce(nullif(v_row->>'status', ''), p_target_status);
    if v_status not in ('draft', 'in_review', 'published') then
      raise exception 'INVALID_QUESTION_STATUS';
    end if;

    insert into questions (
      id, program_id, topic, subtopic, title, prompt, question_type, difficulty,
      marks, time_limit_sec, instructions, starter_code, choices, answer_key,
      grader_config, grading_mode, explanation, tags, status, version, created_by, updated_at
    ) values (
      v_id, v_row->>'programId', v_row->>'topic', nullif(v_row->>'subtopic',''),
      v_row->>'title', v_row->>'prompt', (v_row->>'questionType')::question_type,
      (v_row->>'difficulty')::difficulty, (v_row->>'marks')::integer,
      (v_row->>'timeLimitSec')::integer, coalesce(v_row->>'instructions',''),
      nullif(v_row->>'starterCode',''), v_row->'choices', v_row->>'answerKey',
      coalesce(v_row->'graderConfig','{}'::jsonb), coalesce(nullif(v_row->>'gradingMode',''),'exact'),
      nullif(v_row->>'explanation',''), coalesce(v_row->'tags','[]'::jsonb),
      v_status, v_version, p_actor, now()
    )
    on conflict (id) do update set
      program_id=excluded.program_id, topic=excluded.topic, subtopic=excluded.subtopic,
      title=excluded.title, prompt=excluded.prompt, question_type=excluded.question_type,
      difficulty=excluded.difficulty, marks=excluded.marks, time_limit_sec=excluded.time_limit_sec,
      instructions=excluded.instructions, starter_code=excluded.starter_code, choices=excluded.choices,
      answer_key=excluded.answer_key, grader_config=excluded.grader_config, grading_mode=excluded.grading_mode,
      explanation=excluded.explanation, tags=excluded.tags, status=excluded.status,
      version=excluded.version, created_by=excluded.created_by, updated_at=now();

    update question_import_batches
    set question_ids = array_append(question_ids, v_id)
    where id = v_batch_id;

    insert into audit_logs(actor_id, action, entity, entity_id, new_value)
    values(p_actor, 'import_question', 'question', v_id,
      jsonb_build_object('version', v_version, 'status', v_status, 'batchId', v_batch_id));
  end loop;

  return v_batch_id;
end;
$$;

revoke all on function public.commit_question_import_atomic(text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.commit_question_import_atomic(text,text,jsonb,uuid) to service_role;
