-- 090j 답 내기(wm_answer): 서버 채점 · 한 문제 한 번(처음 답만 기록) · 같은 요청(client_id)은 처음 결과 그대로.
-- 틀리면 정답을 보여 주고, 다른 문제 3개쯤 뒤에 다른 활동으로 한 번만 다시 묻는다(하루 다시 묻기 상한 안에서). 다시 틀려도 더 강요하지 않고 내일로 미룬다.

create or replace function public.wm_answer(p_access text, p_session uuid, p_q int, p_response text, p_client uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_t public.wm_targets := public.wm_target_for(p_access);
  v_s public.wm_sessions;
  v_q jsonb;
  v_prior public.wm_answers;
  v_ok boolean;
  v_help boolean;
  v_retry boolean;
  v_key text;
  v_w public.wm_words;
  v_card jsonb;
  v_newq jsonb;
  v_idx int;
  v_pos int;
  v_requeued boolean := false;
  v_plan_cards jsonb;
  v_ord jsonb;
begin
  select * into v_s from public.wm_sessions where id = p_session and target_id = v_t.id for update;
  if v_s.id is null then raise exception 'not_found'; end if;
  if v_s.day <> public.wm_today() then raise exception 'stale'; end if;
  v_q := v_s.questions -> p_q;
  if v_q is null or v_q->>'kind' <> 'ask' then raise exception 'bad_question'; end if;

  select * into v_prior from public.wm_answers where client_id = p_client or (session_id = v_s.id and q_index = p_q) order by id limit 1;
  if v_prior.id is not null then
    return jsonb_build_object('correct', v_prior.correct, 'answer', public.wm_answer_text(v_q), 'first', false, 'requeued', false, 'done', v_s.done_at is not null);
  end if;

  v_key := v_q->>'key';
  v_help := coalesce((v_q->>'help')::boolean, false);
  v_retry := coalesce((v_q->>'retry')::boolean, false);
  v_ok := public.wm_grade(v_q, p_response);
  insert into public.wm_answers (session_id, q_index, key, style, skill, kind, correct, helped, unaided, response, client_id)
  values (v_s.id, p_q, v_key, v_q->>'style', v_q->>'skill', case when v_retry then 'retry' else 'answer' end, v_ok, v_help, v_ok and not v_help and not v_retry, left(p_response, 200), p_client);
  perform public.wm_apply_result(v_t.id, v_key, v_q->>'skill', v_q->>'style', v_ok, v_help, v_retry);

  if not v_ok and not v_retry and v_s.retry_left > 0
     and not exists (select 1 from jsonb_array_elements(v_s.questions) x where x->>'key' = v_key and coalesce((x->>'retry')::boolean, false)) then
    select cards into v_plan_cards from public.wm_plans where id = v_t.plan_id;
    select * into v_w from public.wm_words where target_id = v_t.id and key = v_key;
    v_card := public.wm_card(v_plan_cards, v_key);
    v_newq := case when v_card is null then null else public.wm_first_q(v_card, v_plan_cards, public.wm_pick_styles(v_w, 'retry', array[v_q->>'style'])) end;
    if v_newq is not null then
      v_idx := jsonb_array_length(v_s.questions);
      select n into v_pos from jsonb_array_elements(v_s.ord) with ordinality as t(e, n) where (e #>> '{}')::int = p_q;
      v_pos := least(coalesce(v_pos, 0) + 3, jsonb_array_length(v_s.ord));
      select coalesce(jsonb_agg(e order by n) filter (where n <= v_pos), '[]'::jsonb) || to_jsonb(v_idx) || coalesce(jsonb_agg(e order by n) filter (where n > v_pos), '[]'::jsonb)
        into v_ord from jsonb_array_elements(v_s.ord) with ordinality as t(e, n);
      update public.wm_sessions
         set questions = questions || jsonb_build_array((jsonb_build_object('kind', 'ask', 'phase', v_q->>'phase', 'key', v_key, 'retry', true, 'i', v_idx) || v_newq)),
             ord = v_ord, retry_left = retry_left - 1
       where id = v_s.id;
      v_requeued := true;
    end if;
  end if;
  return jsonb_build_object('correct', v_ok, 'answer', public.wm_answer_text(v_q), 'first', true, 'requeued', v_requeued, 'helped', v_help,
                            'example', (select c->>'example' from jsonb_array_elements((select cards from public.wm_plans where id = v_t.plan_id)) c where c->>'key' = v_key limit 1),
                            'done', public.wm_check_done(v_s.id));
end $$;
