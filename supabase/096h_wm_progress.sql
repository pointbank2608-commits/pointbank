-- 096h 프로젝트 진행(wm_plan_progress): 구간(50개씩)별 졸업 낱말 수, 졸업(며칠 뒤에도 기억함) 95% 이상이면 "완성", 지금 속도로 몇 월 며칠에 끝나는지(페이스).
--  · 졸업 = 낱말 상태 3(서로 다른 두 날 도움 없이 처음 답으로 맞히고 두 날이 2일 이상 떨어짐). 많이 눌렀다·오래 했다로 완성시키지 않는다.
--  · 페이스: 새 낱말 소개 속도(소개한 수 / 지난 날 수)와 졸업 속도(졸업한 수 / 지난 날 수)로 선형 어림. 기록이 2일 미만이면 null.
-- + 시험용 낱말 목록: wm_plan_cards(구간 범위), wm_plan_weak_cards(아직 졸업 못 한 낱말 — 반에서 많은 순)

create or replace function public.wm_plan_progress(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
  v_today date := public.wm_today();
  v_total int := jsonb_array_length(v_p.cards);
  v_need int := ceil(jsonb_array_length(v_p.cards) * 0.95);
  v_d int := greatest(public.wm_today() - v_p.start_date + 1, 1);
  v_intro_deadline date := v_p.start_date + v_p.study_days;
  v_final_deadline date := v_p.start_date + v_p.study_days + v_p.review_days;
begin
  return jsonb_build_object(
    'words', v_total, 'section_size', 50, 'need_to_graduate', v_need, 'day', v_d, 'intro_deadline', v_intro_deadline, 'final_deadline', v_final_deadline,
    'students', coalesce((
      select jsonb_agg(x.j order by x.name) from (
        select st.name,
          jsonb_build_object(
            'student_id', st.id, 'name', st.name, 'met', m.met, 'kept', m.kept, 'completed', m.kept >= v_need,
            'sections', coalesce(sc.arr, '[]'::jsonb),
            'pace', jsonb_build_object(
              'intro_date', case when m.met >= v_total then v_today when v_d >= 2 and m.met > 0 then v_today + ceil((v_total - m.met) / (m.met::numeric / v_d))::int end,
              'graduate_date', case when m.kept >= v_need then v_today when v_d >= 2 and m.kept > 0 then v_today + ceil((v_need - m.kept) / (m.kept::numeric / v_d))::int end,
              'on_track', case when m.kept >= v_need then true
                               when v_d >= 2 and m.kept > 0 then v_today + ceil((v_need - m.kept) / (m.kept::numeric / v_d))::int <= v_final_deadline end)
          ) as j
        from public.wm_targets t
        join public.students st on st.id = t.student_id
        join lateral (select count(*) filter (where w.introduced_day is not null or w.carried) as met, count(*) filter (where w.stage = 3) as kept
                        from public.wm_words w where w.target_id = t.id) m on true
        left join lateral (
          select jsonb_agg(jsonb_build_object('n', z.n, 'from', (z.n - 1) * 50 + 1, 'to', least(z.n * 50, v_total), 'size', z.size, 'met', z.met, 'kept', z.kept) order by z.n) as arr
            from (select ((o.ord - 1) / 50) + 1 as n, count(*) as size,
                         count(*) filter (where w.introduced_day is not null or w.carried) as met, count(*) filter (where w.stage = 3) as kept
                    from jsonb_array_elements(v_p.cards) with ordinality as o(c, ord)
                    join public.wm_words w on w.target_id = t.id and w.key = o.c->>'key' group by 1) z) sc on true
        where t.plan_id = v_p.id) x), '[]'::jsonb));
end $$;

create or replace function public.wm_plan_cards(p_plan uuid, p_from int, p_to int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('ord', o.ord, 'key', o.c->>'key', 'word', o.c->>'word', 'meaning', o.c->>'meaning', 'pos', o.c->>'pos', 'imageUrl', o.c->>'imageUrl', 'example', o.c->>'example') order by o.ord)
      from jsonb_array_elements(v_p.cards) with ordinality as o(c, ord)
     where o.ord >= greatest(coalesce(p_from, 1), 1) and o.ord <= least(coalesce(p_to, 1000), 1000)), '[]'::jsonb);
end $$;

create or replace function public.wm_plan_weak_cards(p_plan uuid, p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('key', q.key, 'word', q.c->>'word', 'meaning', q.c->>'meaning', 'pos', q.c->>'pos', 'imageUrl', q.c->>'imageUrl', 'example', q.c->>'example') order by q.score desc, q.misses desc, q.ord)
      from (select o.c, o.c->>'key' as key, o.ord, count(*) filter (where w.stage < 3 and (w.introduced_day is not null or w.carried)) as score, coalesce(sum(w.miss), 0) as misses
              from jsonb_array_elements(v_p.cards) with ordinality as o(c, ord)
              join public.wm_words w on w.key = o.c->>'key'
              join public.wm_targets t on t.id = w.target_id and t.plan_id = v_p.id
             group by o.c, o.ord
            having count(*) filter (where w.stage < 3 and (w.introduced_day is not null or w.carried)) > 0
             order by 3 desc, 5 desc, o.ord
             limit least(greatest(coalesce(p_limit, 100), 1), 200)) q), '[]'::jsonb);
end $$;

-- 새 함수 권한: 선생님(로그인 사용자)만. 학생·익명은 못 부른다.
revoke all on function public.wm_plan_briefing(uuid) from public, anon;
revoke all on function public.wm_plan_steps(uuid) from public, anon;
revoke all on function public.wm_apply_step(uuid, uuid, text) from public, anon;
revoke all on function public.wm_plan_progress(uuid) from public, anon;
revoke all on function public.wm_plan_cards(uuid, int, int) from public, anon;
revoke all on function public.wm_plan_weak_cards(uuid, int) from public, anon;
grant execute on function public.wm_plan_briefing(uuid), public.wm_plan_steps(uuid), public.wm_apply_step(uuid, uuid, text), public.wm_plan_progress(uuid),
                          public.wm_plan_cards(uuid, int, int), public.wm_plan_weak_cards(uuid, int) to authenticated;
revoke all on function public.wm_similar_words(jsonb, jsonb, int) from public, anon, authenticated;
