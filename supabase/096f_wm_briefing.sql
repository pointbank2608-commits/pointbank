-- 096f 선생님 아침 브리핑(wm_plan_briefing): 어제 누가 했고 누가 안 했는지, 연속 학습일, 오늘 복습할 낱말 수, 이번 주 반이 가장 헷갈린 낱말.
-- 읽기 전용. 선생님(같은 학원)만. 학생 이름은 선생님 화면에만 간다.

create or replace function public.wm_plan_briefing(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
  v_today date := public.wm_today();
  v_y date := public.wm_today() - 1;
begin
  return jsonb_build_object(
    'today', v_today, 'yesterday', v_y, 'day_index', greatest(v_today - v_p.start_date, 0), 'closed', v_p.closed_at is not null,
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', st.id, 'name', st.name,
        'yesterday', case when coalesce(ys.done, false) then 'done' when coalesce(ys.n, 0) > 0 then 'partial' else 'none' end,
        'answered_yesterday', coalesce(ys.n, 0), 'correct_yesterday', coalesce(ys.ok, 0),
        'today', case when coalesce(ts.done, false) then 'done' when coalesce(ts.n, 0) > 0 then 'started' else 'not_started' end,
        'streak_days', case when dy.days is null then 0 else coalesce((select min(g) from generate_series(0, 120) g
                              where not ((case when v_today = any(dy.days) then v_today else v_y end - g) = any(dy.days))), 121) end, 'inactive_days', case when dy.last_day is null then null else v_today - dy.last_day end,
        'due_today', (select count(*) from public.wm_words w where w.target_id = t.id and (w.introduced_day is not null or w.carried) and coalesce(w.due_day, v_today) <= v_today),
        'hard', (select count(*) from public.wm_words w where w.target_id = t.id and (w.relearning or (w.miss > 0 and w.stage < 3))),
        'stages', public.wm_stage_counts(t.id)
      ) order by st.name)
      from public.wm_targets t
      join public.students st on st.id = t.student_id
      left join lateral (select count(a.id) filter (where a.kind = 'answer') as n, count(a.id) filter (where a.kind = 'answer' and a.correct) as ok, bool_or(s.done_at is not null and jsonb_array_length(s.ord) > 0) as done
                           from public.wm_sessions s left join public.wm_answers a on a.session_id = s.id where s.target_id = t.id and s.day = v_y) ys on true
      left join lateral (select count(a.id) filter (where a.kind = 'answer') as n, bool_or(s.done_at is not null and jsonb_array_length(s.ord) > 0) as done
                           from public.wm_sessions s left join public.wm_answers a on a.session_id = s.id where s.target_id = t.id and s.day = v_today) ts on true
      left join lateral (select max(d) as last_day, array_agg(d) as days
                           from (select distinct s.day as d from public.wm_sessions s join public.wm_answers a on a.session_id = s.id
                                  where s.target_id = t.id and a.kind = 'answer') z) dy on true
      where t.plan_id = v_p.id), '[]'::jsonb),
    'hot_words', coalesce((
      select jsonb_agg(jsonb_build_object('key', k, 'word', wd, 'meaning', mn, 'students', ns, 'misses', ms) order by ms desc, ns desc)
      from (
        select w.key as k, cj.c->>'word' as wd, cj.c->>'meaning' as mn, count(distinct t.id) as ns, sum(w.miss) as ms
          from public.wm_words w
          join public.wm_targets t on t.id = w.target_id
          join lateral (select cc as c from jsonb_array_elements(v_p.cards) cc where cc->>'key' = w.key limit 1) cj on true
         where t.plan_id = v_p.id and w.miss > 0 and w.last_miss_day >= v_today - 6
         group by w.key, cj.c->>'word', cj.c->>'meaning'
         order by sum(w.miss) desc, count(distinct t.id) desc limit 10) x), '[]'::jsonb));
end $$;
