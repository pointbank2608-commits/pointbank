-- Teacher-approved ceilings and automatic pacing for vocabulary projects.
begin;

alter table public.wm_plans add column if not exists initial_new_words integer;
alter table public.wm_plans drop constraint if exists wm_plans_initial_new_words_check;
alter table public.wm_plans add constraint wm_plans_initial_new_words_check
  check (initial_new_words is null or (rule_version = 'wm-v2' and initial_new_words between 1 and jsonb_array_length(cards)));

create or replace function public.wm_project_assign_adaptive(
  p_request_id uuid, p_class_id uuid, p_title text, p_cards jsonb, p_source jsonb,
  p_student_ids uuid[], p_daily_mode text, p_study_days int, p_review_days int, p_new_word_limit int
) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  cards jsonb;
  result jsonb;
begin
  perform public.wm_staff_academy();
  cards := public.wm_clean_cards(p_cards);
  if p_new_word_limit is null or p_new_word_limit not between 1 and jsonb_array_length(cards) then
    raise exception 'bad_new_word_limit';
  end if;
  -- The existing approval fingerprint covers the ceiling as well as the range.
  result := public.wm_project_assign(
    p_request_id, p_class_id, p_title, cards,
    coalesce(p_source, '{}'::jsonb) || jsonb_build_object('initial_new_words', p_new_word_limit),
    p_student_ids, p_daily_mode, p_study_days, p_review_days
  );
  if result->>'plan_id' is not null and not (result->>'duplicate')::boolean then
    update public.wm_plans set initial_new_words = p_new_word_limit where id = (result->>'plan_id')::uuid;
  end if;
  return result;
end $$;

revoke all on function public.wm_project_assign_adaptive(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int,int) from public, anon;
grant execute on function public.wm_project_assign_adaptive(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int,int) to authenticated;

-- Use recent daily sessions and only first, unassisted answers on words introduced on a prior day.
-- Reduce after interruptions or weak recall, and increase only after repeated completion and strong recall.
create or replace function public.wm_project_new_limit(p_target uuid, p_today date, p_ceiling int) returns int
language sql stable set search_path = public, pg_temp as $$
  with recent as (
    select s.id, s.day, s.done_at, coalesce((s.counts->>'new_target')::int, p_ceiling) as load
    from public.wm_sessions s
    where s.target_id = p_target and s.day < p_today and jsonb_array_length(s.ord) > 0
    order by s.day desc limit 3
  ), recall as (
    select count(*) as attempts, count(*) filter (where a.correct) as correct
    from recent r join public.wm_answers a on a.session_id = r.id
    where a.project_evidence is true
  ), completion as (
    select count(*) filter (where done_at is not null) as finished
    from (select done_at from recent order by day desc limit 2) last_two
  )
  select coalesce((
    select least(p_ceiling, case
      when r.done_at is null or r.day < p_today - 1 or (recall.attempts >= 4 and recall.correct * 10 < recall.attempts * 7)
        then greatest(1, r.load / 2)
      when completion.finished = 2 and recall.attempts >= 4 and recall.correct * 100 >= recall.attempts * 85
        then r.load + least(10, greatest(1, ceil(r.load / 4.0)::int))
      else r.load end)
    from recent r cross join recall cross join completion order by r.day desc limit 1
  ), p_ceiling)
$$;

revoke all on function public.wm_project_new_limit(uuid,date,int) from public, anon, authenticated;

create or replace function public.wm_build_session(p_target uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_t public.wm_targets;
  v_p public.wm_plans;
  v_today date := public.wm_today();
  v_id uuid;
  v_par jsonb;
  v_main int;
  v_cap int;
  v_day int;
  v_keys text[];
  v_hard_n int := 0;
  v_unintro text[];
  v_nq int := 0;
  v_revs jsonb[] := '{}';
  v_news jsonb[] := '{}';
  v_pend jsonb[] := '{}';
  v_slots jsonb[] := '{}';
  v_item jsonb;
  v_k text;
  v_ri int := 1;
  v_ni int := 1;
  v_last_study int := -10;
  v_pick int;
  v_n int;
  v_qs jsonb := '[]';
  v_ord jsonb := '[]';
  v_i int;
  v_newrow jsonb;
  v_review_n int;
  v_project boolean;
  v_new_max int;
  v_retry_reserve int;
  v_card_map jsonb;
  v_distractors jsonb;
  v_question_cards jsonb;
begin
  select * into v_t from public.wm_targets where id = p_target for update;
  select s.id into v_id from public.wm_sessions s where s.target_id = p_target and s.day = v_today;
  if v_id is not null then return v_id; end if;
  select * into v_p from public.wm_plans where id = v_t.plan_id;
  v_day := greatest(v_today - v_p.start_date, 0);
  v_project := v_p.rule_version = 'wm-v2';
  if v_project then
    if not exists (select 1 from public.wm_words where target_id = p_target and (stage < 3 or relearning)) then return null; end if;
  elsif v_day >= v_p.study_days + v_p.review_days then return null;
  end if;
  v_par := public.wm_mode_params(coalesce(v_t.mode_override, v_p.daily_mode));
  v_retry_reserve := (v_par->>'reserve')::int;
  v_main := (v_par->>'asks')::int - v_retry_reserve;
  v_new_max := (v_par->>'new_max')::int;
  if v_project then
    v_new_max := public.wm_project_new_limit(p_target, v_today, coalesce(v_p.initial_new_words, v_new_max));
    if v_p.initial_new_words is not null then
      v_main := greatest(10, v_new_max * 2);
      v_retry_reserve := greatest(2, ceil(v_main / 5.0)::int);
      select jsonb_object_agg(c->>'key', c) into v_card_map from jsonb_array_elements(v_p.cards) c;
      -- Include each question's own card and a small daily pool of distractors.
      select coalesce(jsonb_agg(c), '[]'::jsonb) into v_distractors
      from (select c from jsonb_array_elements(v_p.cards) c
            order by md5((c->>'key') || p_target::text || v_today::text) limit 40) pool;
    end if;
  end if;
  v_cap := case when v_project then v_main else floor(v_main * 0.7)::int end;

  -- 복습: 어려운 낱말 먼저, 오래 밀린 순. 상한을 넘으면 나머지는 다음 날로 남는다.
  select coalesce(array_agg(key order by case when v_project then coalesce(due_day, v_today) end, hard desc, miss desc, due_day, key), '{}') into v_keys from (
    select key, (relearning or (miss > 0 and stage < 3)) as hard, miss, due_day
      from public.wm_words
     where target_id = p_target and (introduced_day is not null or carried) and coalesce(due_day, v_today) <= v_today
       and (not v_project or stage < 3 or relearning)
     order by case when v_project then coalesce(due_day, v_today) end,
              (relearning or (miss > 0 and stage < 3)) desc, miss desc, due_day, key
     limit v_cap) x;
  foreach v_k in array v_keys loop
    v_question_cards := case when v_card_map is null then v_p.cards
      else jsonb_build_array(v_card_map->v_k) || v_distractors end;
    v_item := public.wm_review_item(p_target, v_k, v_question_cards, 'review');
    if v_item is not null then
      if exists (select 1 from public.wm_words w where w.target_id = p_target and w.key = v_k and (w.relearning or (w.miss > 0 and w.stage < 3))) then
        v_item := jsonb_set(v_item, '{phase}', '"hard"');
        v_hard_n := v_hard_n + 1;
      end if;
      v_revs := array_append(v_revs, v_item);
    end if;
  end loop;
  v_review_n := coalesce(array_length(v_revs, 1), 0);

  -- 새 낱말: 공부 기간 안, 복습이 적을 때만
  if (v_project or v_day < v_p.study_days) and v_review_n < v_cap then
    select coalesce(array_agg(w.key order by c.ord), '{}') into v_unintro
      from public.wm_words w
      join (select cc->>'key' as key, ord from jsonb_array_elements(v_p.cards) with ordinality as t(cc, ord)) c on c.key = w.key
     where w.target_id = p_target and w.introduced_day is null and not w.carried;
    v_nq := least(v_new_max, floor((v_main - v_review_n) / 2.0)::int, coalesce(array_length(v_unintro, 1), 0));
    for v_i in 1..greatest(v_nq, 0) loop
      v_question_cards := case when v_card_map is null then v_p.cards
        else jsonb_build_array(v_card_map->(v_unintro[v_i])) || v_distractors end;
      v_newrow := public.wm_new_item(p_target, v_unintro[v_i], v_question_cards);
      if v_newrow is not null then v_news := array_append(v_news, v_newrow); end if;
    end loop;
  end if;

  -- 줄 세우기: 새 낱말 소개 카드 뒤 3칸쯤 지나서 알아보기, 8칸쯤 뒤에 다른 활동
  loop
    exit when v_ri > coalesce(array_length(v_revs, 1), 0) and v_ni > coalesce(array_length(v_news, 1), 0) and coalesce(array_length(v_pend, 1), 0) = 0;
    v_n := coalesce(array_length(v_slots, 1), 0);
    v_pick := 0;
    for v_i in 1..coalesce(array_length(v_pend, 1), 0) loop
      if (v_pend[v_i]->>'rel')::int <= v_n and (v_pick = 0 or (v_pend[v_i]->>'rel')::int < (v_pend[v_pick]->>'rel')::int) then
        v_pick := v_i;
      end if;
    end loop;
    if v_pick > 0 then
      v_slots := array_append(v_slots, v_pend[v_pick]->'item');
      v_pend := v_pend[1:v_pick - 1] || v_pend[v_pick + 1:];
    elsif v_ni <= coalesce(array_length(v_news, 1), 0) and ((v_n >= 2 and v_n - v_last_study >= 3) or v_ri > coalesce(array_length(v_revs, 1), 0)) then
      v_slots := array_append(v_slots, v_news[v_ni]->'study');
      v_pend := array_append(v_pend, jsonb_build_object('rel', v_n + 4, 'item', v_news[v_ni]->'a1'));
      if v_news[v_ni]->'a2' is not null and v_news[v_ni]->>'a2' is not null then
        v_pend := array_append(v_pend, jsonb_build_object('rel', v_n + 9, 'item', v_news[v_ni]->'a2'));
      end if;
      v_last_study := v_n;
      v_ni := v_ni + 1;
    elsif v_ri <= coalesce(array_length(v_revs, 1), 0) then
      v_slots := array_append(v_slots, v_revs[v_ri]);
      v_ri := v_ri + 1;
    else
      -- 더 채울 복습이 없으면 가장 이른 대기 항목을 앞당긴다
      v_pick := 1;
      for v_i in 2..coalesce(array_length(v_pend, 1), 0) loop
        if (v_pend[v_i]->>'rel')::int < (v_pend[v_pick]->>'rel')::int then v_pick := v_i; end if;
      end loop;
      v_slots := array_append(v_slots, v_pend[v_pick]->'item');
      v_pend := v_pend[1:v_pick - 1] || v_pend[v_pick + 1:];
    end if;
  end loop;

  select coalesce(jsonb_agg((slot - 'q') || coalesce(slot->'q', '{}'::jsonb) || jsonb_build_object('i', position - 1)
                            order by position), '[]'::jsonb),
         coalesce(jsonb_agg(position - 1 order by position), '[]'::jsonb)
    into v_qs, v_ord
    from unnest(v_slots) with ordinality as slots(slot, position);

  insert into public.wm_sessions (target_id, day, questions, ord, main_budget, retry_left, counts, done_at)
  values (p_target, v_today, v_qs, v_ord, v_main, v_retry_reserve,
          jsonb_build_object('review', v_review_n - v_hard_n, 'hard', v_hard_n, 'new', coalesce(array_length(v_news, 1), 0),
                             'asks', (select count(*) from jsonb_array_elements(v_qs) q where q->>'kind' = 'ask'))
            || case when v_project then jsonb_build_object('new_target', v_new_max) else '{}'::jsonb end,
          case when jsonb_array_length(v_qs) = 0 then public.wm_now() end)
  on conflict (target_id, day) do nothing
  returning id into v_id;
  if v_id is null then
    select s.id into v_id from public.wm_sessions s where s.target_id = p_target and s.day = v_today;
  end if;
  return v_id;
end $$;

create or replace function public.wm_plan_progress(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
  v_today date := public.wm_today();
  v_total int := jsonb_array_length(v_p.cards);
  v_project boolean := v_p.rule_version = 'wm-v2';
  v_need int := case when v_project then v_total else ceil(v_total * 0.95)::int end;
  v_d int := greatest(public.wm_today() - v_p.start_date + 1, 1);
  v_intro_deadline date := v_p.start_date + v_p.study_days;
  v_final_deadline date := v_p.start_date + v_p.study_days + v_p.review_days;
begin
  return jsonb_build_object(
    'words', v_total, 'section_size', 50, 'need_to_graduate', v_need, 'day', v_d, 'intro_deadline', v_intro_deadline, 'final_deadline', v_final_deadline,
    'daily_mode', v_p.daily_mode, 'initial_new_words', v_p.initial_new_words, 'start_date', v_p.start_date, 'today', v_today,
    'study_days', v_p.study_days, 'review_days', v_p.review_days, 'goal_date', v_final_deadline,
    'students', coalesce((
      select jsonb_agg(x.j order by x.name) from (
        select st.name,
          jsonb_build_object(
            'student_id', st.id, 'name', st.name, 'met', m.met, 'kept', m.kept, 'completed', m.kept >= v_need,
            'current_mode', coalesce(t.mode_override, v_p.daily_mode),
            'today_new_words', (select (s.counts->>'new')::int from public.wm_sessions s where s.target_id=t.id and s.day=v_today),
            'sections', coalesce(sc.arr, '[]'::jsonb),
            'pace', jsonb_build_object(
              'intro_date', case when m.met >= v_total then v_today when v_d >= 2 and m.met > 0 then v_today + ceil((v_total - m.met) / (m.met::numeric / v_d))::int end,
              'graduate_date', case when m.kept >= v_need then v_today when v_d >= 2 and m.kept > 0 then v_today + ceil((v_need - m.kept) / (m.kept::numeric / v_d))::int end,
              'on_track', case when m.kept >= v_need then true
                               when v_d >= 2 and m.kept > 0 then v_today + ceil((v_need - m.kept) / (m.kept::numeric / v_d))::int <= v_final_deadline end)
          ) || case when v_project then jsonb_build_object('project', public.wm_project_status(t.id, v_final_deadline)) else '{}'::jsonb end as j
        from public.wm_targets t
        join public.students st on st.id = t.student_id
        join lateral (select count(*) filter (where w.introduced_day is not null or w.carried) as met, count(*) filter (where w.stage = 3 and (not v_project or not w.relearning)) as kept
                        from public.wm_words w where w.target_id = t.id) m on true
        left join lateral (
          select jsonb_agg(jsonb_build_object('n', z.n, 'from', (z.n - 1) * 50 + 1, 'to', least(z.n * 50, v_total), 'size', z.size, 'met', z.met, 'kept', z.kept) order by z.n) as arr
            from (select ((o.ord - 1) / 50) + 1 as n, count(*) as size,
                         count(*) filter (where w.introduced_day is not null or w.carried) as met, count(*) filter (where w.stage = 3 and (not v_project or not w.relearning)) as kept
                    from jsonb_array_elements(v_p.cards) with ordinality as o(c, ord)
                    join public.wm_words w on w.target_id = t.id and w.key = o.c->>'key' group by 1) z) sc on true
        where t.plan_id = v_p.id) x), '[]'::jsonb));
end $$;

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

    if v_p.initial_new_words is null then
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
    end if;

    if v_top is not null and v_topn >= 3 and v_tot > 0 and v_topn * 10 >= v_tot * 4 and r.focus_skill is distinct from v_top then
      v_steps := v_steps || jsonb_build_object('action', 'focus_' || v_top, 'reason', jsonb_build_object('code', 'weak_skill', 'skill', v_top, 'count', v_topn));
    elsif r.focus_skill is not null then
      if coalesce((select sum((e.value)::int) from public.wm_words w, jsonb_each_text(w.skill_miss) e where w.target_id = r.id and w.stage < 3 and e.key = r.focus_skill), 0) < 2 then
        v_steps := v_steps || jsonb_build_object('action', 'clear_focus', 'reason', jsonb_build_object('code', 'focus_improved', 'skill', r.focus_skill));
      end if;
    end if;

    v_out := v_out || jsonb_build_object('student_id', r.student_id, 'name', r.name, 'mode', v_mode, 'initial_new_words', v_p.initial_new_words, 'focus', r.focus_skill, 'answers_7d', v_n, 'accuracy_7d', v_pct, 'steps', v_steps);
  end loop;
  return v_out;
end $$;

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
  if v_p.initial_new_words is not null and p_action in ('lighter', 'heavier') then raise exception 'automatic_pace'; end if;
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

commit;
