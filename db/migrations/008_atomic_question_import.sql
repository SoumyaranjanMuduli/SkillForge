begin;

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

commit;
