-- 096g 다음 단계 카드: 학생 기록으로 "분량을 줄일까요/늘릴까요/약한 능력에 집중할까요"를 규칙으로 제안하고(AI 아님),
-- 선생님이 승인(wm_apply_step)해야만 학생의 하루 학습이 바뀐다. 자동으로 바꾸지 않는다. 바꾼 내용은 wm_step_log 에 남는다.
--  제안 규칙(최근 7일): 3일 넘게 안 함 → 분량 줄이기 / 정답률 60% 미만(20문제 이상) → 분량 줄이기 / 5일 이상 하고 정답률 90% 이상(40문제 이상) → 분량 늘리기
--                       틀린 능력 하나가 전체 틀림의 40% 이상(3번 이상) → 그 능력 집중 / 집중 중인데 그 능력 틀림이 2번 미만 → 집중 끝내기

create or replace function public.wm_plan_steps(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
  v_today date := public.wm_today();
  r record;
  v_out jsonb := '[]'::jsonb;
  v_steps jsonb;
  v_mode text;
  v_n int;
  v_ok int;
  v_days int;
  v_inact int;
  v_top text;
  v_topn int;
  v_tot int;
  v_pct int;
begin
  for r in select t.id, t.student_id, st.name, t.mode_override, t.focus_skill
             from public.wm_targets t join public.students st on st.id = t.student_id where t.plan_id = v_p.id order by st.name loop
    v_mode := coalesce(r.mode_override, v_p.daily_mode);
    v_steps := '[]'::jsonb;
    select count(*) filter (where a.kind = 'answer'), count(*) filter (where a.kind = 'answer' and a.correct), count(distinct s.day) filter (where a.kind = 'answer')
      into v_n, v_ok, v_days
      from public.wm_answers a join public.wm_sessions s on s.id = a.session_id where s.target_id = r.id and s.day >= v_today - 6;
    select v_today - max(s.day) into v_inact from public.wm_sessions s join public.wm_answers a on a.session_id = s.id where s.target_id = r.id and a.kind = 'answer';
    v_pct := case when v_n > 0 then round(100.0 * v_ok / v_n) else null end;
    select k, c into v_top, v_topn from (select e.key as k, sum((e.value)::int) as c from public.wm_words w, jsonb_each_text(w.skill_miss) e
                                          where w.target_id = r.id and w.stage < 3 and e.key in ('spelling', 'listening', 'meaning', 'context') group by e.key order by 2 desc limit 1) z;
    select coalesce(sum((e.value)::int), 0) into v_tot from public.wm_words w, jsonb_each_text(w.skill_miss) e where w.target_id = r.id and w.stage < 3;

    if (v_inact is null and v_today - v_p.start_date >= 3) or coalesce(v_inact, 0) >= 3 then
      if v_mode <> 'light' then
        v_steps := v_steps || jsonb_build_object('action', 'lighter', 'reason', jsonb_build_object('code', 'inactive', 'days', coalesce(v_inact, v_today - v_p.start_date)));
      end if;
    elsif v_n >= 20 and v_ok * 10 < v_n * 6 then
      if v_mode <> 'light' then
        v_steps := v_steps || jsonb_build_object('action', 'lighter', 'reason', jsonb_build_object('code', 'low_accuracy', 'pct', v_pct));
      end if;
    elsif v_days >= 5 and v_n >= 40 and v_ok * 10 >= v_n * 9 then
      if v_mode <> 'plus' then
        v_steps := v_steps || jsonb_build_object('action', 'heavier', 'reason', jsonb_build_object('code', 'steady', 'pct', v_pct, 'days', v_days));
      end if;
    end if;

    if v_top is not null and v_topn >= 3 and v_tot > 0 and v_topn * 10 >= v_tot * 4 and r.focus_skill is distinct from v_top then
      v_steps := v_steps || jsonb_build_object('action', 'focus_' || v_top, 'reason', jsonb_build_object('code', 'weak_skill', 'skill', v_top, 'count', v_topn));
    elsif r.focus_skill is not null then
      if coalesce((select sum((e.value)::int) from public.wm_words w, jsonb_each_text(w.skill_miss) e where w.target_id = r.id and w.stage < 3 and e.key = r.focus_skill), 0) < 2 then
        v_steps := v_steps || jsonb_build_object('action', 'clear_focus', 'reason', jsonb_build_object('code', 'focus_improved', 'skill', r.focus_skill));
      end if;
    end if;

    v_out := v_out || jsonb_build_object('student_id', r.student_id, 'name', r.name, 'mode', v_mode, 'focus', r.focus_skill, 'answers_7d', v_n, 'accuracy_7d', v_pct, 'steps', v_steps);
  end loop;
  return v_out;
end $$;

-- 선생님이 카드 하나를 승인: lighter / heavier / focus_spelling|listening|meaning|context / clear_focus
create or replace function public.wm_apply_step(p_plan uuid, p_student uuid, p_action text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
  v_t public.wm_targets;
  v_cur text;
  v_new_mode text;
  v_new_focus text;
begin
  select * into v_t from public.wm_targets where plan_id = v_p.id and student_id = p_student;
  if v_t.id is null then raise exception 'not_found'; end if;
  if p_action not in ('lighter', 'heavier', 'focus_spelling', 'focus_listening', 'focus_meaning', 'focus_context', 'clear_focus') then raise exception 'bad_action'; end if;
  v_cur := coalesce(v_t.mode_override, v_p.daily_mode);
  v_new_mode := v_t.mode_override;
  v_new_focus := v_t.focus_skill;
  if p_action = 'lighter' then v_new_mode := case v_cur when 'plus' then 'normal' else 'light' end;
  elsif p_action = 'heavier' then v_new_mode := case v_cur when 'light' then 'normal' else 'plus' end;
  elsif p_action = 'clear_focus' then v_new_focus := null;
  else v_new_focus := substr(p_action, 7);
  end if;
  update public.wm_targets set mode_override = v_new_mode, focus_skill = v_new_focus where id = v_t.id;
  insert into public.wm_step_log (plan_id, target_id, action, before_state, after_state, created_by)
  values (v_p.id, v_t.id, p_action, jsonb_build_object('mode', v_cur, 'focus', v_t.focus_skill), jsonb_build_object('mode', coalesce(v_new_mode, v_p.daily_mode), 'focus', v_new_focus), auth.uid());
  return jsonb_build_object('mode', coalesce(v_new_mode, v_p.daily_mode), 'focus', v_new_focus);
end $$;
