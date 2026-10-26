-- 090h 학생(개인 링크 열쇠): 열기·오늘 학습 받기. 정답·낱말 열쇠는 학생에게 보내지 않는다.

-- 열쇠 → 대상(없음·폐쇄·기능 닫힘은 여기서 막는다). 내부용(권한 없음).
create or replace function public.wm_target_for(p_access text) returns public.wm_targets
language plpgsql stable security definer set search_path = public as $$
declare
  v_t public.wm_targets;
  v_p public.wm_plans;
begin
  select * into v_t from public.wm_targets where access_token = btrim(coalesce(p_access, ''));
  if v_t.id is null then raise exception 'not_found'; end if;
  if exists (select 1 from public.students s where s.id = v_t.student_id and s.archived_at is not null) then raise exception 'not_found'; end if;
  select * into v_p from public.wm_plans where id = v_t.plan_id;
  if v_p.closed_at is not null then raise exception 'closed'; end if;
  if not public.academy_feature(v_p.academy_id, 'homework') then raise exception 'feature_closed'; end if;
  return v_t;
end $$;

-- 단계별 낱말 수 {unseen, seen, practicing, alone, kept}
create or replace function public.wm_stage_counts(p_target uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'unseen', count(*) filter (where introduced_day is null and not carried),
    'seen', count(*) filter (where (introduced_day is not null or carried) and stage = 0),
    'practicing', count(*) filter (where stage = 1),
    'alone', count(*) filter (where stage = 2),
    'kept', count(*) filter (where stage = 3),
    'total', count(*))
  from public.wm_words where target_id = p_target
$$;

-- 학생에게 보내는 오늘 학습(정답·열쇠 제외, 푼 문제는 결과만)
create or replace function public.wm_session_payload(p_session uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'session_id', s.id, 'day', s.day, 'done', s.done_at is not null, 'counts', s.counts,
    'retry_left', s.retry_left,
    'items', coalesce((
      select jsonb_agg(
        case when a.id is not null then
          jsonb_build_object('i', (o.idx)::int, 'kind', q->>'kind', 'phase', q->>'phase', 'state', 'done', 'correct', a.correct,
                             'retry', coalesce((q->>'retry')::boolean, false))
        else (q - 'correct' - 'key' - 'skill') || jsonb_build_object('state', 'todo') end
        order by o.n)
      from jsonb_array_elements(s.ord) with ordinality as o(idx, n)
      join lateral (select s.questions -> (o.idx #>> '{}')::int as q) qq on true
      left join public.wm_answers a on a.session_id = s.id and a.q_index = (o.idx #>> '{}')::int
    ), '[]'::jsonb))
  from public.wm_sessions s where s.id = p_session
$$;

create or replace function public.wm_open(p_access text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_t public.wm_targets := public.wm_target_for(p_access);
  v_p public.wm_plans;
  v_day int;
begin
  select * into v_p from public.wm_plans where id = v_t.plan_id;
  v_day := greatest(public.wm_today() - v_p.start_date, 0);
  return jsonb_build_object(
    'title', v_p.title, 'student_name', (select name from public.students where id = v_t.student_id),
    'daily_mode', v_p.daily_mode, 'day_index', v_day, 'study_days', v_p.study_days, 'review_days', v_p.review_days,
    'phase', case when v_day < v_p.study_days then 'study' when v_day < v_p.study_days + v_p.review_days then 'review' else 'ended' end,
    'stages', public.wm_stage_counts(v_t.id), 'rule_version', v_p.rule_version);
end $$;

create or replace function public.wm_today_state(p_access text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_t public.wm_targets := public.wm_target_for(p_access);
  v_id uuid;
  v_today date := public.wm_today();
  v_pay jsonb;
  v_due int;
  v_inc int;
begin
  v_id := public.wm_build_session(v_t.id);
  if v_id is null then
    return jsonb_build_object('ended', true, 'stages', public.wm_stage_counts(v_t.id));
  end if;
  v_pay := public.wm_session_payload(v_id);
  select count(*) into v_due from public.wm_words where target_id = v_t.id and (introduced_day is not null or carried) and coalesce(due_day, v_today) <= v_today;
  select count(*) into v_inc from public.wm_sessions s, jsonb_array_elements(s.questions) q
   where s.id = v_id and q->>'kind' = 'ask' and q->>'phase' in ('review', 'hard');
  return v_pay || jsonb_build_object(
    'waiting_review', greatest(v_due - v_inc, 0),
    'next_due', (select min(due_day) from public.wm_words where target_id = v_t.id and due_day > v_today),
    'stages', public.wm_stage_counts(v_t.id),
    'unseen', (select count(*) from public.wm_words where target_id = v_t.id and introduced_day is null and not carried));
end $$;
