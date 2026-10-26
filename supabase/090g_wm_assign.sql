-- 090g 선생님: 단어암기숙제 배정(wm_assign). 멱등: 같은 request_id 는 같은 계획을 돌려주고 빠진 학생만 더한다.
--  · 단어는 이 순간의 스냅샷으로 저장(원본 단어장을 고치거나 지워도 그대로). 열쇠 = 낱말|뜻 → 같은 철자·다른 뜻은 따로 센다.
--  · 같은 학생이 같은 단어 묶음(cards_hash)을 이미 진행 중이면 중복으로 만들지 않고 건너뛴다(skipped).
--  · 예전에 같은 낱말·뜻을 공부한 기록이 있으면 일부만 이어받는다: "다시 확인할 낱말"로 시작하고, 이미 외웠다고 판정하지 않는다(단계는 0부터).

create or replace function public.wm_staff_academy() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() or public.my_academy_id() is null then
    raise exception 'not_staff';
  end if;
  return public.my_academy_id();
end $$;

-- 카드 목록을 정리해 열쇠를 붙인다(낱말·뜻이 없는 줄·중복 열쇠는 뺀다)
create or replace function public.wm_clean_cards(p_cards jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(c order by ord), '[]'::jsonb) from (
    select distinct on (k) k, ord, jsonb_strip_nulls(jsonb_build_object(
      'key', k, 'word', btrim(x->>'word'), 'meaning', btrim(x->>'meaning'),
      'pos', nullif(btrim(coalesce(x->>'pos', '')), ''),
      'imageUrl', nullif(btrim(coalesce(x->>'imageUrl', '')), ''),
      'example', nullif(btrim(coalesce(x->>'example', '')), ''))) as c
    from (select x, ord, public.wm_key(x->>'word', x->>'meaning') as k
            from jsonb_array_elements(case when jsonb_typeof(p_cards) = 'array' then p_cards else '[]'::jsonb end) with ordinality as t(x, ord)
           where btrim(coalesce(x->>'word', '')) <> '' and btrim(coalesce(x->>'meaning', '')) <> '') q
    order by k, ord
  ) z
$$;

create or replace function public.wm_assign(
  p_request_id uuid, p_class_id uuid, p_title text, p_cards jsonb, p_source jsonb,
  p_student_ids uuid[], p_daily_mode text, p_study_days int default 14, p_review_days int default 14
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_academy uuid := public.wm_staff_academy();
  v_cards jsonb;
  v_hash text;
  v_plan public.wm_plans;
  v_dup boolean := false;
  v_sid uuid;
  v_tid uuid;
  v_created int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_total int;
begin
  if not public.academy_feature(v_academy, 'homework') then raise exception 'feature_closed'; end if;
  if p_daily_mode not in ('light', 'normal') then raise exception 'bad_mode'; end if;
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.academy_id = v_academy) then raise exception 'bad_class'; end if;
  v_cards := public.wm_clean_cards(p_cards);
  if jsonb_array_length(v_cards) < 4 then raise exception 'too_few_words'; end if;
  if jsonb_array_length(v_cards) > 400 then raise exception 'too_many_words'; end if;
  if p_student_ids is null or cardinality(p_student_ids) = 0 then raise exception 'no_students'; end if;
  if exists (select 1 from unnest(p_student_ids) u where not exists (
       select 1 from public.students s where s.id = u and s.academy_id = v_academy and s.class_id = p_class_id and s.archived_at is null)) then
    raise exception 'bad_student';
  end if;
  select md5(string_agg(c->>'key', ',' order by c->>'key')) into v_hash from jsonb_array_elements(v_cards) c;

  select * into v_plan from public.wm_plans where academy_id = v_academy and request_id = p_request_id;
  if v_plan.id is not null then
    v_dup := true;
    if v_plan.class_id <> p_class_id then raise exception 'request_conflict'; end if;
  else
    insert into public.wm_plans (academy_id, class_id, request_id, title, source, cards, cards_hash, daily_mode, study_days, review_days, start_date, created_by)
    values (v_academy, p_class_id, p_request_id, coalesce(btrim(p_title), ''), coalesce(p_source, '{}'::jsonb), v_cards, v_hash, p_daily_mode,
            least(greatest(coalesce(p_study_days, 14), 3), 60), least(greatest(coalesce(p_review_days, 14), 0), 60), public.wm_today(), auth.uid())
    returning * into v_plan;
  end if;

  foreach v_sid in array p_student_ids loop
    if exists (select 1 from public.wm_targets t where t.plan_id = v_plan.id and t.student_id = v_sid) then continue; end if;
    if exists (select 1 from public.wm_targets t join public.wm_plans p on p.id = t.plan_id
                where t.student_id = v_sid and p.id <> v_plan.id and p.cards_hash = v_hash and p.class_id = p_class_id and p.closed_at is null
                  and public.wm_today() < p.start_date + p.study_days + p.review_days) then
      v_skipped := v_skipped || to_jsonb(v_sid);
      continue;
    end if;
    insert into public.wm_targets (plan_id, student_id) values (v_plan.id, v_sid) returning id into v_tid;
    insert into public.wm_words (target_id, key, carried, due_day, ok_total, miss, skill_miss, last_skill)
    select v_tid, c->>'key', prev.key is not null, case when prev.key is not null then v_plan.start_date end,
           least(coalesce(prev.ok_total, 0), 2), coalesce(prev.miss, 0), coalesce(prev.skill_miss, '{}'::jsonb), prev.last_skill
      from jsonb_array_elements(v_plan.cards) c
      left join lateral (
        select w.* from public.wm_words w join public.wm_targets t2 on t2.id = w.target_id
         where t2.student_id = v_sid and t2.id <> v_tid and w.key = c->>'key' and w.introduced_day is not null
         order by w.updated_at desc limit 1) prev on true;
    v_created := v_created + 1;
  end loop;
  select count(*) into v_total from public.wm_targets where plan_id = v_plan.id;
  if v_total = 0 then
    delete from public.wm_plans where id = v_plan.id;
    return jsonb_build_object('plan_id', null, 'duplicate', v_dup, 'created', 0, 'skipped', v_skipped, 'total', 0, 'words', jsonb_array_length(v_cards));
  end if;
  return jsonb_build_object('plan_id', v_plan.id, 'duplicate', v_dup, 'created', v_created, 'skipped', v_skipped, 'total', v_total, 'words', jsonb_array_length(v_plan.cards));
end $$;
