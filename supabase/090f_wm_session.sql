-- 090f 하루 학습 조립(wm_build_session): 오늘 할 복습·새 낱말을 고르고 소개 카드·알아보기·복습이 섞이게 줄 세운다.

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
begin
  select s.id into v_id from public.wm_sessions s where s.target_id = p_target and s.day = v_today;
  if v_id is not null then return v_id; end if;
  select * into v_t from public.wm_targets where id = p_target;
  select * into v_p from public.wm_plans where id = v_t.plan_id;
  v_day := greatest(v_today - v_p.start_date, 0);
  if v_day >= v_p.study_days + v_p.review_days then return null; end if;
  v_par := public.wm_mode_params(v_p.daily_mode);
  v_main := (v_par->>'asks')::int - (v_par->>'reserve')::int;
  v_cap := floor(v_main * 0.7);

  -- 복습: 어려운 낱말 먼저, 오래 밀린 순. 상한을 넘으면 나머지는 다음 날로 남는다.
  select coalesce(array_agg(key order by hard desc, miss desc, due_day, key), '{}') into v_keys from (
    select key, (relearning or (miss > 0 and stage < 3)) as hard, miss, due_day
      from public.wm_words
     where target_id = p_target and (introduced_day is not null or carried) and coalesce(due_day, v_today) <= v_today
     order by (relearning or (miss > 0 and stage < 3)) desc, miss desc, due_day, key
     limit v_cap) x;
  foreach v_k in array v_keys loop
    v_item := public.wm_review_item(p_target, v_k, v_p.cards, 'review');
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
  if v_day < v_p.study_days and v_review_n < v_cap then
    select coalesce(array_agg(w.key order by c.ord), '{}') into v_unintro
      from public.wm_words w
      join (select cc->>'key' as key, ord from jsonb_array_elements(v_p.cards) with ordinality as t(cc, ord)) c on c.key = w.key
     where w.target_id = p_target and w.introduced_day is null and not w.carried;
    v_nq := least((v_par->>'new_max')::int, floor((v_main - v_review_n) / 2.0)::int, coalesce(array_length(v_unintro, 1), 0));
    for v_i in 1..greatest(v_nq, 0) loop
      v_newrow := public.wm_new_item(p_target, v_unintro[v_i], v_p.cards);
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

  for v_i in 1..coalesce(array_length(v_slots, 1), 0) loop
    v_qs := v_qs || jsonb_build_array((v_slots[v_i] - 'q') || coalesce(v_slots[v_i]->'q', '{}'::jsonb) || jsonb_build_object('i', v_i - 1));
    v_ord := v_ord || to_jsonb(v_i - 1);
  end loop;

  insert into public.wm_sessions (target_id, day, questions, ord, main_budget, retry_left, counts, done_at)
  values (p_target, v_today, v_qs, v_ord, v_main, (v_par->>'reserve')::int,
          jsonb_build_object('review', v_review_n - v_hard_n, 'hard', v_hard_n, 'new', coalesce(array_length(v_news, 1), 0),
                             'asks', (select count(*) from jsonb_array_elements(v_qs) q where q->>'kind' = 'ask')),
          case when jsonb_array_length(v_qs) = 0 then public.wm_now() end)
  on conflict (target_id, day) do nothing
  returning id into v_id;
  if v_id is null then
    select s.id into v_id from public.wm_sessions s where s.target_id = p_target and s.day = v_today;
  end if;
  return v_id;
end $$;
