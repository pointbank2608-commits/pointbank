-- Automatic word projects. Existing assignments retain wm-v1.
begin;

create table if not exists public.wm_project_approvals (
  academy_id uuid not null references public.academies(id) on delete cascade,
  request_id uuid not null,
  fingerprint text not null,
  response jsonb not null,
  primary key (academy_id, request_id)
);
alter table public.wm_project_approvals enable row level security;
revoke all on public.wm_project_approvals from public, anon, authenticated;
alter table public.wm_answers add column if not exists project_evidence boolean;
alter table public.wm_plans drop constraint if exists wm_plans_study_days_check;
alter table public.wm_plans add constraint wm_plans_study_days_check
  check (study_days between 3 and 3650 and (rule_version = 'wm-v2' or study_days <= 240));

create or replace function public.wm_project_assign(
  p_request_id uuid, p_class_id uuid, p_title text, p_cards jsonb, p_source jsonb,
  p_student_ids uuid[], p_daily_mode text, p_study_days int default 14, p_review_days int default 14
) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  academy uuid := public.wm_staff_academy();
  cards jsonb;
  title text := coalesce(btrim(p_title), '');
  source jsonb := coalesce(p_source, '{}'::jsonb);
  students uuid[];
  cards_hash text;
  fingerprint text;
  plan public.wm_plans;
  student uuid;
  target uuid;
  skipped uuid[] := '{}';
  assigned int := 0;
  prior public.wm_project_approvals;
  result jsonb;
begin
  if not public.academy_feature(academy, 'homework') then raise exception 'feature_closed'; end if;
  if p_request_id is null then raise exception 'missing_request'; end if;
  if p_daily_mode is null or p_daily_mode not in ('light', 'normal', 'plus') then raise exception 'bad_mode'; end if;
  if p_study_days is null or p_study_days not between 3 and 3650 or p_review_days is null or p_review_days not between 0 and 90 then
    raise exception 'bad_duration';
  end if;
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.academy_id = academy) then raise exception 'bad_class'; end if;
  cards := public.wm_clean_cards(p_cards);
  if jsonb_array_length(cards) < 4 then raise exception 'too_few_words'; end if;

  select array_agg(distinct s order by s) into students from unnest(p_student_ids) s;
  if coalesce(cardinality(students), 0) = 0 then raise exception 'no_students'; end if;
  if exists (select 1 from unnest(students) s where not exists (
    select 1 from public.students st where st.id = s and st.academy_id = academy and st.class_id = p_class_id and st.archived_at is null
  )) then raise exception 'bad_student'; end if;
  select md5(string_agg(c->>'key', ',' order by c->>'key')) into cards_hash from jsonb_array_elements(cards) c;
  fingerprint := md5(jsonb_build_array(p_class_id, title, cards, source, students, p_daily_mode, p_study_days, p_review_days)::text);

  perform pg_advisory_xact_lock(hashtextextended('wm-project-request:' || academy || ':' || p_request_id, 0));
  select * into prior from public.wm_project_approvals a where a.academy_id = academy and a.request_id = p_request_id;
  if found then
    if prior.fingerprint is distinct from fingerprint then raise exception 'request_conflict'; end if;
    return prior.response || jsonb_build_object('duplicate', true, 'created', 0);
  end if;
  if exists (select 1 from public.wm_plans p where p.academy_id = academy and p.request_id = p_request_id) then
    raise exception 'request_conflict';
  end if;

  insert into public.wm_plans (academy_id, class_id, request_id, title, source, cards, cards_hash, daily_mode,
    study_days, review_days, start_date, rule_version, created_by)
  values (academy, p_class_id, p_request_id, title, source, cards, cards_hash, p_daily_mode,
    p_study_days, p_review_days, public.wm_today(), 'wm-v2', auth.uid())
  returning * into plan;

  foreach student in array students loop
    perform pg_advisory_xact_lock(hashtextextended('wm-project-student:' || student, 0));
    if exists (
      select 1 from public.wm_targets t join public.wm_plans p on p.id = t.plan_id
      where t.student_id = student and p.class_id = p_class_id and p.cards_hash = plan.cards_hash and p.closed_at is null
        and case when p.rule_version = 'wm-v2' then exists (
          select 1 from public.wm_words w where w.target_id = t.id and (w.stage < 3 or w.relearning)
        ) else public.wm_today() < p.start_date + p.study_days + p.review_days end
    ) then
      skipped := array_append(skipped, student);
      continue;
    end if;
    insert into public.wm_targets (plan_id, student_id) values (plan.id, student) returning id into target;
    insert into public.wm_words (target_id, key, carried, due_day)
    select target, c->>'key', prev.key is not null, case when prev.key is not null then plan.start_date end
      from jsonb_array_elements(plan.cards) c
      left join lateral (
        select w.key from public.wm_words w join public.wm_targets t on t.id = w.target_id
          join public.wm_plans previous on previous.id = t.plan_id and previous.academy_id = academy
         where t.student_id = student and w.key = c->>'key' and w.introduced_day is not null
         limit 1
      ) prev on true;
    assigned := assigned + 1;
  end loop;
  if assigned = 0 then delete from public.wm_plans where id = plan.id; end if;
  result := jsonb_build_object('plan_id', case when assigned > 0 then plan.id end, 'duplicate', false,
    'created', assigned, 'skipped', skipped, 'total', assigned, 'words', jsonb_array_length(cards));
  insert into public.wm_project_approvals (academy_id, request_id, fingerprint, response)
    values (academy, p_request_id, fingerprint, result);
  return result;
end $$;

-- Project goals are measured with delayed, independent evidence, separate from the daily workload.
create or replace function public.wm_project_status(p_target uuid, p_goal date) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'goal_date', p_goal,
    'goal_passed', public.wm_today() >= p_goal,
    'verified', count(*) filter (where stage = 3 and not relearning),
    'needs_review', count(*) filter (where (stage < 3 or relearning)
      and last_miss_day is not null and (last_ok_day is null or last_miss_day >= last_ok_day)),
    'unconfirmed', count(*) filter (where (stage < 3 or relearning)
      and (last_miss_day is null or last_ok_day > last_miss_day)),
    'review_due', count(*) filter (where (stage < 3 or relearning)
      and (introduced_day is not null or carried) and coalesce(due_day, public.wm_today()) <= public.wm_today()),
    'total', count(*),
    'completed', count(*) > 0 and bool_and(stage = 3 and not relearning)
  )
  from public.wm_words where target_id = p_target
$$;

-- Lower the new-word load after a missed or unfinished session, or weak independent recall.
-- The teacher's daily mode is always the ceiling. The calendar target never raises the load.
create or replace function public.wm_project_new_limit(p_target uuid, p_today date, p_ceiling int) returns int
language sql stable set search_path = public, pg_temp as $$
  with recent as (
    select s.id, s.day, s.done_at from public.wm_sessions s
    where s.target_id = p_target and s.day < p_today and jsonb_array_length(s.ord) > 0
    order by s.day desc limit 3
  ), recall as (
    select count(*) as attempts, count(*) filter (where a.correct) as correct
    from recent r join public.wm_answers a on a.session_id = r.id
    where a.project_evidence is true
  )
  select case when exists(select 1 from recent) and (
      (select day < p_today - 1 or done_at is null from recent order by day desc limit 1)
      or exists(select 1 from recall where attempts >= 4 and correct * 10 < attempts * 7)
    ) then greatest(1, p_ceiling / 2) else p_ceiling end
$$;

revoke all on function public.wm_project_assign(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int) from public, anon;
grant execute on function public.wm_project_assign(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int) to authenticated;
revoke all on function public.wm_project_status(uuid,date), public.wm_project_new_limit(uuid,date,int) from public, anon, authenticated;

create or replace function public.wm_review_item(p_target uuid, p_key text, p_cards jsonb, p_phase text) returns jsonb
language plpgsql volatile as $$
declare
  v_w public.wm_words;
  v_card jsonb := public.wm_card(p_cards, p_key);
  v_q jsonb;
  v_project boolean;
begin
  select * into v_w from public.wm_words where target_id = p_target and key = p_key;
  if v_card is null or v_w.key is null then return null; end if;
  select p.rule_version = 'wm-v2' into v_project from public.wm_targets t join public.wm_plans p on p.id = t.plan_id where t.id = p_target;
  v_q := public.wm_first_q(v_card, p_cards, public.wm_pick_styles(v_w, 'review',
    case when v_project then array['copy', 'hint', 'fade', 'flash'] else '{}'::text[] end));
  if v_q is null then return null; end if;
  return jsonb_build_object('kind', 'ask', 'phase', p_phase, 'key', p_key, 'q', v_q);
end $$;

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
  v_main := (v_par->>'asks')::int - (v_par->>'reserve')::int;
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
  if (v_project or v_day < v_p.study_days) and v_review_n < v_cap then
    v_new_max := (v_par->>'new_max')::int;
    if v_project then v_new_max := public.wm_project_new_limit(p_target, v_today, v_new_max); end if;
    select coalesce(array_agg(w.key order by c.ord), '{}') into v_unintro
      from public.wm_words w
      join (select cc->>'key' as key, ord from jsonb_array_elements(v_p.cards) with ordinality as t(cc, ord)) c on c.key = w.key
     where w.target_id = p_target and w.introduced_day is null and not w.carried;
    v_nq := least(v_new_max, floor((v_main - v_review_n) / 2.0)::int, coalesce(array_length(v_unintro, 1), 0));
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

create or replace function public.wm_apply_result(p_target uuid, p_key text, p_skill text, p_style text, p_correct boolean, p_helped boolean, p_retry boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w public.wm_words;
  v_today date := public.wm_today();
  v_evidence boolean;
  v_project boolean;
  v_ladder int[] := array[2, 4, 7, 14];
begin
  select * into w from public.wm_words where target_id = p_target and key = p_key for update;
  if w.key is null then return; end if;
  select p.rule_version = 'wm-v2' into v_project from public.wm_targets t join public.wm_plans p on p.id = t.plan_id where t.id = p_target;
  v_evidence := case when v_project then w.introduced_day < v_today
                      and w.last_seen_day is distinct from v_today
                      and p_style not in ('copy', 'hint', 'fade', 'flash')
                    else w.introduced_day is null or w.introduced_day < v_today end;
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
  v_project boolean;
  v_project_evidence boolean;
begin
  select * into v_s from public.wm_sessions where id = p_session and target_id = v_t.id for update;
  if v_s.id is null then raise exception 'not_found'; end if;
  if v_s.day <> public.wm_today() then raise exception 'stale'; end if;
  v_q := v_s.questions -> p_q;
  if v_q is null or v_q->>'kind' <> 'ask' then raise exception 'bad_question'; end if;

  select p.rule_version = 'wm-v2' into v_project from public.wm_plans p where p.id = v_t.plan_id;
  if v_project and exists (select 1 from public.wm_answers a where a.client_id = p_client
    and (a.session_id <> v_s.id or a.q_index <> p_q)) then raise exception 'request_conflict'; end if;
  select * into v_prior from public.wm_answers where (not v_project and client_id = p_client) or (session_id = v_s.id and q_index = p_q) order by id limit 1;
  if v_prior.id is not null then
    return jsonb_build_object('correct', v_prior.correct, 'answer', public.wm_answer_text(v_q), 'first', false, 'requeued', false, 'done', v_s.done_at is not null);
  end if;

  v_key := v_q->>'key';
  v_help := coalesce((v_q->>'help')::boolean, false) or (v_project and v_q->>'style' in ('copy', 'hint', 'fade', 'flash'));
  v_retry := coalesce((v_q->>'retry')::boolean, false);
  v_ok := public.wm_grade(v_q, p_response);
  if v_project then
    v_project_evidence := not v_help and not v_retry and v_q->>'phase' in ('review', 'hard') and exists (
      select 1 from public.wm_words w where w.target_id = v_t.id and w.key = v_key
        and w.introduced_day < v_s.day and w.last_seen_day is distinct from v_s.day
    );
  end if;
  insert into public.wm_answers (session_id, q_index, key, style, skill, kind, correct, helped, unaided, response, client_id, project_evidence)
  values (v_s.id, p_q, v_key, v_q->>'style', v_q->>'skill', case when v_retry then 'retry' else 'answer' end, v_ok, v_help, v_ok and not v_help and not v_retry, left(p_response, 200), p_client, v_project_evidence);
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

create or replace function public.wm_open(p_access text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_t public.wm_targets := public.wm_target_for(p_access);
  v_p public.wm_plans;
  v_day int;
  project jsonb;
begin
  select * into v_p from public.wm_plans where id = v_t.plan_id;
  v_day := greatest(public.wm_today() - v_p.start_date, 0);
  if v_p.rule_version = 'wm-v2' then
    project := public.wm_project_status(v_t.id, v_p.start_date + v_p.study_days + v_p.review_days);
  end if;
  return jsonb_build_object(
    'title', v_p.title, 'student_name', (select name from public.students where id = v_t.student_id),
    'daily_mode', v_p.daily_mode, 'day_index', v_day, 'study_days', v_p.study_days, 'review_days', v_p.review_days,
    'phase', case when (project->>'completed')::boolean then 'ended'
                  when project is not null then 'study' when v_day < v_p.study_days then 'study' when v_day < v_p.study_days + v_p.review_days then 'review' else 'ended' end,
    'stages', public.wm_stage_counts(v_t.id), 'rule_version', v_p.rule_version) || case when project is null then '{}'::jsonb else jsonb_build_object('project', project) end;
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
  v_p public.wm_plans;
  project jsonb;
begin
  v_id := public.wm_build_session(v_t.id);
  select * into v_p from public.wm_plans where id = v_t.plan_id;
  if v_p.rule_version = 'wm-v2' then
    project := public.wm_project_status(v_t.id, v_p.start_date + v_p.study_days + v_p.review_days);
  end if;
  if v_id is null then
    return jsonb_build_object('ended', true, 'stages', public.wm_stage_counts(v_t.id))
      || case when project is null then '{}'::jsonb else jsonb_build_object(
        'project', project, 'day', v_today, 'done', true, 'items', '[]'::jsonb,
        'counts', jsonb_build_object('review', 0, 'hard', 0, 'new', 0, 'asks', 0),
        'retry_left', 0, 'waiting_review', 0, 'next_due', null, 'unseen', 0
      ) end;
  end if;
  v_pay := public.wm_session_payload(v_id);
  select count(*) into v_due from public.wm_words where target_id = v_t.id and (introduced_day is not null or carried) and coalesce(due_day, v_today) <= v_today and (project is null or stage < 3 or relearning);
  if project is null then
    select count(*) into v_inc from public.wm_sessions s, jsonb_array_elements(s.questions) q
     where s.id = v_id and q->>'kind' = 'ask' and q->>'phase' in ('review', 'hard');
  else
    select count(distinct w.key) into v_inc
    from public.wm_sessions s cross join lateral jsonb_array_elements(s.questions) q
      join public.wm_words w on w.target_id = v_t.id and w.key = q->>'key'
    where s.id = v_id and q->>'kind' = 'ask' and q->>'phase' in ('review', 'hard')
      and (w.stage < 3 or w.relearning) and coalesce(w.due_day, v_today) <= v_today
      and not exists (select 1 from public.wm_answers a where a.session_id = s.id and a.q_index = (q->>'i')::int);
  end if;
  return v_pay || jsonb_build_object(
    'waiting_review', greatest(v_due - v_inc, 0),
    'next_due', (select min(due_day) from public.wm_words where target_id = v_t.id and due_day > v_today and (project is null or stage < 3 or relearning)),
    'stages', public.wm_stage_counts(v_t.id),
    'unseen', (select count(*) from public.wm_words where target_id = v_t.id and introduced_day is null and not carried))
    || case when project is null then '{}'::jsonb else jsonb_build_object('project', project) end;
end $$;

create or replace function public.wm_student_links(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_sid uuid;
  v_today date := public.wm_today();
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return '[]'::jsonb;
  end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('title', p.title, 'access', t.access_token,
             'phase', case when v_today - p.start_date < p.study_days then 'study' else 'review' end) order by p.created_at desc)
      from public.wm_targets t join public.wm_plans p on p.id = t.plan_id
     where t.student_id = v_sid and p.closed_at is null and (p.rule_version = 'wm-v2' or v_today - p.start_date < p.study_days + p.review_days)
       and public.academy_feature(p.academy_id, 'homework')), '[]'::jsonb);
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
      'ended', p.rule_version <> 'wm-v2' and v_today - p.start_date >= p.study_days + p.review_days,
      'rule_version', p.rule_version,
      'students', (select count(*) from public.wm_targets t where t.plan_id = p.id),
      'today_done', (select count(*) from public.wm_sessions s join public.wm_targets t on t.id = s.target_id
                      where t.plan_id = p.id and s.day = v_today and s.done_at is not null and jsonb_array_length(s.ord) > 0),
      'created_at', p.created_at) order by p.created_at desc)
    from public.wm_plans p where p.academy_id = v_academy and (p_class_id is null or p.class_id = p_class_id)), '[]'::jsonb);
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
    'daily_mode', v_p.daily_mode, 'start_date', v_p.start_date, 'today', v_today,
    'study_days', v_p.study_days, 'review_days', v_p.review_days, 'goal_date', v_final_deadline,
    'students', coalesce((
      select jsonb_agg(x.j order by x.name) from (
        select st.name,
          jsonb_build_object(
            'student_id', st.id, 'name', st.name, 'met', m.met, 'kept', m.kept, 'completed', m.kept >= v_need,
            'current_mode', coalesce(t.mode_override, v_p.daily_mode),
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

create or replace function public.wm_plan_cards(p_plan uuid, p_from int, p_to int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('ord', o.ord, 'key', o.c->>'key', 'word', o.c->>'word', 'meaning', o.c->>'meaning', 'pos', o.c->>'pos', 'imageUrl', o.c->>'imageUrl', 'example', o.c->>'example') order by o.ord)
      from jsonb_array_elements(v_p.cards) with ordinality as o(c, ord)
     where o.ord >= greatest(coalesce(p_from, 1), 1) and o.ord <= least(coalesce(p_to, 1000), case when v_p.rule_version = 'wm-v2' then jsonb_array_length(v_p.cards) else 1000 end)), '[]'::jsonb);
end $$;

commit;
