-- 090i 낱말 상태 갱신 규칙(wm-v1) + 소개 카드 확인 + 도움말.
-- 숙련 판정(많이 눌렀다·오래 했다로 완료시키지 않는다):
--  · 처음 만남(0): 소개 카드를 봤다 / 연습 중(1): 문제를 풀어 봤다(소개 당일 맞힌 것·도움 받은 것·다시 풀기 포함)
--  · 혼자 맞힘(2): 소개한 날 이후에, 도움 없이, 처음 답으로 맞혔다 / 며칠 뒤에도 기억함(3): 서로 다른 두 날에 위 조건을 만족하고 두 날이 2일 이상 떨어져 있다
--  · 틀리면 다음 날 다시(streak 0). 단계는 내리지 않고 "다시 확인해요"(relearning)로 표시한다.
--  · 다음 복습: 연속 성공 1회 +2일, 2회 +4일, 3회 +7일, 4회 이상 +14일. 틀림·도움·다시 풀기는 +1일.

create or replace function public.wm_apply_result(p_target uuid, p_key text, p_skill text, p_style text, p_correct boolean, p_helped boolean, p_retry boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w public.wm_words;
  v_today date := public.wm_today();
  v_evidence boolean;
  v_ladder int[] := array[2, 4, 7, 14];
begin
  select * into w from public.wm_words where target_id = p_target and key = p_key for update;
  if w.key is null then return; end if;
  v_evidence := w.introduced_day is null or w.introduced_day < v_today;
  w.tries := w.tries + 1;
  w.last_seen_day := v_today;
  w.last_style := p_style;
  if w.introduced_day is null then w.introduced_day := v_today; end if;

  if p_retry then
    w.stage := greatest(w.stage, 1);
    w.streak := 0;
    w.due_day := v_today + 1;
  elsif p_correct and not p_helped then
    w.ok_total := w.ok_total + 1;
    if v_evidence then
      w.unaided_ok := w.unaided_ok + 1;
      if not (v_today = any(w.unaided_days)) then w.unaided_days := array_append(w.unaided_days, v_today); end if;
      w.first_ok_day := coalesce(w.first_ok_day, v_today);
      w.last_ok_day := v_today;
      w.streak := w.streak + 1;
      w.stage := greatest(w.stage, 2);
      if cardinality(w.unaided_days) >= 2 and w.last_ok_day - w.first_ok_day >= 2 then w.stage := 3; end if;
      w.relearning := false;
      if w.last_skill = p_skill then w.last_skill := null; end if;
      w.due_day := v_today + v_ladder[least(w.streak, 4)];
    else
      w.stage := greatest(w.stage, 1);
      w.due_day := v_today + 1;
    end if;
  elsif p_correct then
    w.stage := greatest(w.stage, 1);
    w.streak := 0;
    w.due_day := v_today + 1;
  else
    w.miss := w.miss + 1;
    if w.last_miss_day is distinct from v_today then w.miss_days := w.miss_days + 1; end if;
    w.last_miss_day := v_today;
    w.skill_miss := jsonb_set(w.skill_miss, array[p_skill], to_jsonb(coalesce((w.skill_miss->>p_skill)::int, 0) + 1));
    w.last_skill := p_skill;
    w.streak := 0;
    w.stage := greatest(w.stage, 1);
    if w.stage >= 2 then w.relearning := true; end if;
    w.due_day := v_today + 1;
  end if;
  update public.wm_words set stage = w.stage, introduced_day = w.introduced_day, tries = w.tries, ok_total = w.ok_total, unaided_ok = w.unaided_ok,
    unaided_days = w.unaided_days, first_ok_day = w.first_ok_day, last_ok_day = w.last_ok_day, streak = w.streak, miss = w.miss, miss_days = w.miss_days,
    last_miss_day = w.last_miss_day, skill_miss = w.skill_miss, last_skill = w.last_skill, last_style = w.last_style, relearning = w.relearning,
    due_day = w.due_day, last_seen_day = w.last_seen_day, updated_at = public.wm_now()
   where target_id = p_target and key = p_key;
end $$;

create or replace function public.wm_check_done(p_session uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if exists (select 1 from public.wm_sessions s, jsonb_array_elements_text(s.ord) o
              where s.id = p_session and not exists (select 1 from public.wm_answers a where a.session_id = s.id and a.q_index = o::int)) then
    return false;
  end if;
  update public.wm_sessions set done_at = coalesce(done_at, public.wm_now()) where id = p_session;
  return true;
end $$;

-- 소개 카드를 봤다(처음 만남). 같은 요청은 한 번만.
create or replace function public.wm_ack(p_access text, p_session uuid, p_q int, p_client uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_t public.wm_targets := public.wm_target_for(p_access);
  v_s public.wm_sessions;
  v_q jsonb;
  v_today date := public.wm_today();
begin
  select * into v_s from public.wm_sessions where id = p_session and target_id = v_t.id for update;
  if v_s.id is null then raise exception 'not_found'; end if;
  if v_s.day <> v_today then raise exception 'stale'; end if;
  v_q := v_s.questions -> p_q;
  if v_q is null or v_q->>'kind' <> 'study' then raise exception 'bad_question'; end if;
  insert into public.wm_answers (session_id, q_index, key, kind, client_id) values (v_s.id, p_q, v_q->>'key', 'ack', p_client)
  on conflict do nothing;
  if found then
    update public.wm_words set introduced_day = coalesce(introduced_day, v_today), last_seen_day = v_today,
           due_day = coalesce(due_day, v_today + 1), updated_at = public.wm_now()
     where target_id = v_t.id and key = v_q->>'key';
  end if;
  return jsonb_build_object('ok', true, 'done', public.wm_check_done(v_s.id));
end $$;

-- 도움말: 보기 하나 지우기(고르기) · 첫 글자(철자) · 첫 조각(배열). 쓰면 이 문제는 "도움 받음"으로 기록된다.
create or replace function public.wm_hint(p_access text, p_session uuid, p_q int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_t public.wm_targets := public.wm_target_for(p_access);
  v_s public.wm_sessions;
  v_q jsonb;
  v_elim jsonb;
  v_idx int;
  v_out jsonb;
begin
  select * into v_s from public.wm_sessions where id = p_session and target_id = v_t.id for update;
  if v_s.id is null then raise exception 'not_found'; end if;
  v_q := v_s.questions -> p_q;
  if v_q is null or v_q->>'kind' <> 'ask' then raise exception 'bad_question'; end if;
  if exists (select 1 from public.wm_answers a where a.session_id = v_s.id and a.q_index = p_q) then raise exception 'answered'; end if;
  if v_q->>'qtype' = 'choice' then
    v_elim := coalesce(v_q->'elim', '[]'::jsonb);
    select i - 1 into v_idx from generate_series(1, jsonb_array_length(v_q->'choices')) i
     where i - 1 <> (v_q->>'correct')::int and not (v_elim @> to_jsonb(i - 1)) order by i limit 1;
    if v_idx is null then return jsonb_build_object('type', 'none'); end if;
    v_q := jsonb_set(jsonb_set(v_q, '{elim}', v_elim || to_jsonb(v_idx)), '{help}', 'true');
    v_out := jsonb_build_object('type', 'eliminate', 'index', v_idx);
  elsif v_q->>'qtype' = 'text' then
    v_out := jsonb_build_object('type', 'letters', 'text', left(split_part(v_q->>'correct', '/', 1), 1) || repeat(' _', greatest(length(split_part(v_q->>'correct', '/', 1)) - 1, 0)));
    v_q := jsonb_set(jsonb_set(v_q, '{help}', 'true'), '{hint}', v_out->'text');
  else
    v_out := jsonb_build_object('type', 'first', 'text', v_q->'correct'->>0);
    v_q := jsonb_set(jsonb_set(v_q, '{help}', 'true'), '{hint}', v_out->'text');
  end if;
  update public.wm_sessions set questions = jsonb_set(questions, array[p_q::text], v_q) where id = v_s.id;
  return v_out;
end $$;
