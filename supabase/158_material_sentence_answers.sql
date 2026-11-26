-- Preserve the complete typed sentence and ordered answer in both result tables.
-- This implementation stays behind the authenticated attempt/identity checks in hw_submit.
begin;

create or replace function public.hw_submit_before_blocks(p_token uuid, p_item_id uuid, p_q_index int, p_response text, p_client_id uuid, p_ms int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_i public.homework_items;
  v_q jsonb;
  v_ok boolean;
  v_first boolean;
  response_limit integer := 200;
  v_e public.learning_events;
  v_academy uuid;
begin
  -- 같은 요청이 다시 오면 처음 결과를 그대로 돌려준다(네트워크 재시도)
  select * into v_e from public.learning_events where client_id = p_client_id;
  if v_e.id is not null then
    select * into v_i from public.homework_items where id = v_e.item_id;
    return jsonb_build_object('correct', v_e.correct, 'answer', public.hw_answer_text(v_i.content->'questions'->v_e.q_index), 'first', v_e.event_type = 'answer');
  end if;
  v_t := public.hw_attempt_for(p_token);
  select * into v_i from public.homework_items where id = p_item_id and assignment_id = v_t.assignment_id;
  if v_i.id is null then
    raise exception 'not_found';
  end if;
  v_q := v_i.content->'questions'->p_q_index;
  if v_q is null then
    raise exception 'not_found';
  end if;
  -- The material composer accepts up to 300 characters for text or ordered sentences.
  if (v_i.config#>>'{block,method}' = 'material:write' and v_q->>'qtype' = 'text')
    or (v_i.config#>>'{block,method}' = 'material:order' and v_q->>'qtype' = 'order') then
    response_limit := 300;
    if length(p_response) > response_limit then raise exception 'bad_response'; end if;
  end if;
  v_ok := public.hw_grade(v_q, left(p_response, 300));
  select academy_id into v_academy from public.homework_assignments where id = v_t.assignment_id;

  insert into public.homework_item_attempts (attempt_id, item_id) values (v_t.id, v_i.id) on conflict (attempt_id, item_id) do nothing;
  insert into public.homework_answers (attempt_id, item_id, q_index, skill, word, correct, response, ms)
  values (v_t.id, v_i.id, p_q_index, coalesce(v_q->>'skill', ''), coalesce(v_q->>'word', ''), v_ok, left(p_response, response_limit), greatest(0, least(p_ms, 3600000)))
  on conflict (attempt_id, item_id, q_index) do nothing;
  v_first := found;
  if not v_first then
    update public.homework_item_attempts set retry_count = retry_count + 1 where attempt_id = v_t.id and item_id = v_i.id;
  end if;

  insert into public.learning_events (academy_id, student_id, assignment_id, item_id, attempt_id, q_index, event_type, skill, word, content_id, difficulty, correct, response, ms, meta, client_id)
  values (v_academy, v_t.student_id, v_t.assignment_id, v_i.id, v_t.id, p_q_index,
          case when v_first then 'answer' else 'retry_answer' end,
          v_q->>'skill', v_q->>'word', v_q->>'contentId', coalesce((v_q->>'difficulty')::int, 1), v_ok, left(p_response, response_limit),
          greatest(0, least(p_ms, 3600000)), coalesce(v_q->'card', '{}'::jsonb) || jsonb_build_object('qtype', v_q->>'qtype', 'item_kind', v_i.kind), p_client_id)
  on conflict (client_id) do nothing;
  update public.homework_attempts set last_seen_at = now() where id = v_t.id;
  return jsonb_build_object('correct', v_ok, 'answer', public.hw_answer_text(v_q), 'first', v_first);
end $$;

revoke all on function public.hw_submit_before_blocks(uuid,uuid,int,text,uuid,int) from public,anon,authenticated;
commit;
