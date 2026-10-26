-- 090k 단어 수집장(학생) + 선생님 현황·링크·닫기.

-- 학생: 단어 수집장. 아직 안 만난 낱말은 낱말·뜻을 보내지 않는다.
create or replace function public.wm_collection(p_access text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_t public.wm_targets := public.wm_target_for(p_access);
begin
  return jsonb_build_object('stages', public.wm_stage_counts(v_t.id), 'words', coalesce((
    select jsonb_agg(
      case when w.introduced_day is null and not w.carried then jsonb_build_object('state', 'unseen')
      else jsonb_strip_nulls(jsonb_build_object('state', case w.stage when 3 then 'kept' when 2 then 'alone' when 1 then 'practicing' else 'seen' end,
        'word', c->>'word', 'meaning', c->>'meaning', 'imageUrl', c->>'imageUrl', 'pos', c->>'pos',
        'relearning', w.relearning, 'carried', w.carried, 'days', cardinality(w.unaided_days))) end
      order by o.ord)
    from public.wm_plans p
    join lateral jsonb_array_elements(p.cards) with ordinality as o(c, ord) on true
    join public.wm_words w on w.target_id = v_t.id and w.key = o.c->>'key'
    where p.id = v_t.plan_id), '[]'::jsonb));
end $$;

create or replace function public.wm_plan_for_staff(p_plan uuid) returns public.wm_plans
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans;
begin
  select * into v_p from public.wm_plans where id = p_plan and academy_id = public.wm_staff_academy();
  if v_p.id is null then raise exception 'not_found'; end if;
  return v_p;
end $$;

create or replace function public.wm_plan_list(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_academy uuid := public.wm_staff_academy();
  v_today date := public.wm_today();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'title', p.title, 'source', p.source, 'words', jsonb_array_length(p.cards), 'daily_mode', p.daily_mode,
      'start_date', p.start_date, 'study_days', p.study_days, 'review_days', p.review_days, 'closed', p.closed_at is not null,
      'day_index', greatest(v_today - p.start_date, 0),
      'ended', v_today - p.start_date >= p.study_days + p.review_days,
      'students', (select count(*) from public.wm_targets t where t.plan_id = p.id),
      'today_done', (select count(*) from public.wm_sessions s join public.wm_targets t on t.id = s.target_id
                      where t.plan_id = p.id and s.day = v_today and s.done_at is not null and jsonb_array_length(s.ord) > 0),
      'created_at', p.created_at) order by p.created_at desc)
    from public.wm_plans p where p.academy_id = v_academy and (p_class_id is null or p.class_id = p_class_id)), '[]'::jsonb);
end $$;

create or replace function public.wm_plan_results(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
  v_today date := public.wm_today();
begin
  return jsonb_build_object('plan', jsonb_build_object('id', v_p.id, 'title', v_p.title, 'words', jsonb_array_length(v_p.cards), 'daily_mode', v_p.daily_mode,
      'start_date', v_p.start_date, 'study_days', v_p.study_days, 'review_days', v_p.review_days, 'rule_version', v_p.rule_version, 'closed', v_p.closed_at is not null),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', st.id, 'name', st.name,
        'today', coalesce((select case when s.done_at is not null and jsonb_array_length(s.ord) > 0 then 'done' when jsonb_array_length(s.ord) = 0 then 'nothing' else 'started' end
                             from public.wm_sessions s where s.target_id = t.id and s.day = v_today), 'not_started'),
        'last_active', (select max(last_seen_day) from public.wm_words w where w.target_id = t.id),
        'stages', public.wm_stage_counts(t.id),
        'met', (select count(*) from public.wm_words w where w.target_id = t.id and w.introduced_day is not null),
        'alone_words', (select count(*) from public.wm_words w where w.target_id = t.id and w.unaided_ok > 0),
        'kept_words', (select count(*) from public.wm_words w where w.target_id = t.id and w.stage = 3),
        'hard_words', (select count(*) from public.wm_words w where w.target_id = t.id and (w.relearning or (w.miss > 0 and w.stage < 3))),
        'skill_miss', coalesce((select jsonb_object_agg(k, total) from (
            select e.key as k, sum((e.value)::int) as total from public.wm_words w, jsonb_each_text(w.skill_miss) e
             where w.target_id = t.id and w.stage < 3 group by e.key) z), '{}'::jsonb),
        'days_active', (select count(distinct s.day) from public.wm_sessions s where s.target_id = t.id and exists (select 1 from public.wm_answers a where a.session_id = s.id))
      ) order by st.name)
      from public.wm_targets t join public.students st on st.id = t.student_id where t.plan_id = v_p.id), '[]'::jsonb));
end $$;

create or replace function public.wm_plan_links(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('student_id', st.id, 'name', st.name, 'access', t.access_token) order by st.name)
                     from public.wm_targets t join public.students st on st.id = t.student_id where t.plan_id = v_p.id), '[]'::jsonb);
end $$;

create or replace function public.wm_plan_close(p_plan uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
begin
  update public.wm_plans set closed_at = coalesce(closed_at, public.wm_now()) where id = v_p.id;
end $$;
