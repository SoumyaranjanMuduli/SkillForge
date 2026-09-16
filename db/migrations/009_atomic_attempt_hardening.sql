-- SkillForge production hardening: make assessment start + snapshot creation and answer save atomic.
-- Existing databases: apply after migrations 001-008.

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
