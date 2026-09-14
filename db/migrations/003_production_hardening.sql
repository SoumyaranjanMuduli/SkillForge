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
