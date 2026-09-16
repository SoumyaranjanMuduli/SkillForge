-- Final security hardening for existing SkillForge deployments.

begin;

-- Only server-side service-role code may mutate attempts/answers. Students read their
-- own attempt state but cannot forge attempt rows, grades, or answer state directly.
drop policy if exists "attempts_self_insert" on public.attempts;
drop policy if exists "answers_self_insert_active" on public.attempt_answers;
drop policy if exists "answers_self_update_active" on public.attempt_answers;

revoke insert, update, delete on public.attempts from anon, authenticated;
revoke insert, update, delete on public.attempt_answers from anon, authenticated;

-- Server-side helper to finalize grading atomically. It verifies ownership and the attempt
-- state before applying all answer grades and the final attempt state in one transaction.
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
  if p_status not in ('auto_graded', 'under_review') then
    raise exception 'INVALID_FINAL_STATUS';
  end if;

  select * into v_attempt
  from attempts
  where id = p_attempt_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.status <> 'submitted' then
    raise exception 'ATTEMPT_NOT_SUBMITTED';
  end if;

  if p_duration_sec < 0 then
    raise exception 'INVALID_DURATION';
  end if;

  if p_score < 0 or p_score > v_attempt.max_score then
    raise exception 'INVALID_SCORE';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'INVALID_UPDATES';
  end if;

  for item in select * from jsonb_array_elements(p_updates)
  loop
    update attempt_answers
    set is_correct = (item->>'isCorrect')::boolean,
        score = (item->>'score')::numeric,
        feedback = item->>'feedback',
        grading_status = coalesce(item->>'gradingStatus', 'completed'),
        requires_review = coalesce((item->>'requiresReview')::boolean, false),
        updated_at = now()
    where attempt_id = p_attempt_id
      and question_id = item->>'questionId';

    if not found then
      insert into attempt_answers(
        attempt_id, question_id, answer, is_correct, score, feedback,
        time_spent_sec, grading_status, requires_review
      ) values (
        p_attempt_id,
        item->>'questionId',
        coalesce(item->>'answer', ''),
        (item->>'isCorrect')::boolean,
        (item->>'score')::numeric,
        item->>'feedback',
        coalesce((item->>'timeSpentSec')::integer, 0),
        coalesce(item->>'gradingStatus', 'completed'),
        coalesce((item->>'requiresReview')::boolean, false)
      );
    end if;
  end loop;

  update attempts
  set submitted_at = p_submitted_at,
      duration_sec = p_duration_sec,
      score = p_score,
      status = p_status,
      last_activity_at = now()
  where id = p_attempt_id and status = 'submitted';

  return true;
end;
$$;

revoke all on function public.finalize_attempt_atomic(uuid, uuid, text, timestamptz, integer, numeric, jsonb)
from public, anon, authenticated;
grant execute on function public.finalize_attempt_atomic(uuid, uuid, text, timestamptz, integer, numeric, jsonb)
to service_role;

-- Prevent malformed auto-graded questions from silently awarding full credit.
create or replace function public.validate_question_grading_config()
returns trigger
language plpgsql
as $$
declare
  mode text;
  tests jsonb;
begin
  mode := lower(coalesce(new.grading_mode, 'exact'));

  if new.question_type in ('mcq', 'true_false', 'multi_select', 'text', 'numeric')
     and mode <> 'manual'
     and (new.answer_key is null or btrim(new.answer_key) = '') then
    raise exception 'AUTO_GRADED_QUESTION_REQUIRES_ANSWER_KEY';
  end if;

  if new.question_type in ('python', 'sql', 'code') and mode <> 'manual' then
    tests := new.grader_config->'tests';
    if tests is null or jsonb_typeof(tests) <> 'array' or jsonb_array_length(tests) = 0 then
      raise exception 'EXECUTABLE_QUESTION_REQUIRES_TESTS';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_question_grading_config on public.questions;
create trigger trg_validate_question_grading_config
before insert or update on public.questions
for each row execute function public.validate_question_grading_config();

commit;
