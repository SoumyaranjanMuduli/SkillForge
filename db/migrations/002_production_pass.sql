-- SkillForge production pass: topics, account status, atomic attempt start, stronger indexes/RLS.
alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active','disabled'));
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.questions add column if not exists topic_id uuid;

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
alter table public.questions drop constraint if exists questions_topic_id_fkey;
alter table public.questions add constraint questions_topic_id_fkey foreign key (topic_id) references public.topics(id) on delete set null;

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
