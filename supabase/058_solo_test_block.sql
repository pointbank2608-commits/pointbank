-- ============================================================
-- 058 개별수업 시험 블록(2026-10-12, 1단계)
--
-- 시험 블록 = 단계 하나(t = 'test')에 문제 여러 개(items)를 담는다.
-- 수업 단계와 달리 틀려도 정답을 바로 알려 주지 않고, 학생이 다 푼 뒤 답안을 한 번에 내면 서버가 채점한다.
--  - solo_public_step   : 시험 안 문제마다 정답을 뺀다(같은 함수를 문제마다 다시 부른다)
--  - solo_test_results  : 시험 결과(낸 수업·시험 단계마다 한 번만) — 다시 내면 처음 결과를 그대로 돌려준다
--  - solo_test_submit   : (학생) 답안 내기 → 채점 + 문제마다 기록(solo_step_events, 낱말 포함 → 복습·누적 테스트에 쓰인다)
--  - solo_test_summary  : (선생님) 이 수업의 시험 결과
--  - solo_advance       : 시험을 내기 전에는 시험 단계를 건너뛸 수 없게
--  - solo_event_set_word: 기록에 낱말을 직접 넣었으면 그대로 둔다(시험은 문제마다 낱말이 다르다)
-- 실행: 이 파일 하나. 끝의 select 가 모두 true 여야 한다.
-- ============================================================

-- ---------- 1) 학생에게 보내는 모양: 시험 안 문제도 정답을 뺀다 ----------
create or replace function public.solo_public_step(p jsonb) returns jsonb
language sql stable set search_path = public
as $$
  select case
    when p->>'t' = 'test' then
      p || jsonb_build_object('items', (
        select coalesce(jsonb_agg(public.solo_public_step(i) order by n), '[]'::jsonb)
          from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) with ordinality as x(i, n)
         where i->>'t' <> 'test'
      ))
    when p->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick', 'pickPos') then p - 'answer'
    when p->>'t' in ('spell', 'typeWord') then p - 'word'
    when p->>'t' = 'unscramble' then p - 'sentence'
    when p->>'t' = 'meet' and coalesce(p->>'pos', '') = '' then
      p || jsonb_build_object('pos', (
        select b.part_of_speech
          from public.word_bank b
         where lower(b.word) = lower(p->>'word')
         order by (b.meaning = p->>'meaning') desc, b.sense_number
         limit 1
      ))
    else p
  end
$$;

-- ---------- 2) 낱말 기록: 직접 넣은 낱말은 그대로 ----------
create or replace function public.solo_event_set_word() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_step jsonb;
begin
  if new.word is not null then
    return new;
  end if;
  select x.s into v_step
    from public.solo_assignments a
    join public.solo_lessons l on l.id = a.lesson_id,
         jsonb_array_elements(l.steps) with ordinality as x(s, n)
   where a.id = new.assignment_id and x.n = new.step_index + 1;
  if v_step is not null then
    new.word := public.solo_step_word(v_step);
  end if;
  return new;
end $$;

-- ---------- 3) 시험 결과 ----------
create table if not exists public.solo_test_results (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.solo_assignments (id) on delete cascade,
  step_index int not null,
  answers jsonb not null default '[]'::jsonb,
  -- 학생에게 돌려준 결과 그대로: { score, total, by_area: {영역: {right, total}}, items: [{correct, answer}] }
  result jsonb not null,
  score int not null,
  total int not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, step_index)
);
alter table public.solo_test_results enable row level security;
revoke all on public.solo_test_results from anon, authenticated;
drop policy if exists solo_test_results_staff on public.solo_test_results;
create policy solo_test_results_staff on public.solo_test_results
  for select using (exists (
    select 1 from public.solo_assignments a
     where a.id = assignment_id and a.academy_id = public.my_academy_id() and public.is_staff()
  ));
grant select on public.solo_test_results to authenticated;

-- ---------- 4) (학생) 답안 내기 → 채점 ----------
create or replace function public.solo_test_submit(p_token uuid, p_assignment uuid, p_step int, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_step jsonb;
  v_total_steps int;
  v_prev public.solo_test_results;
  v_item jsonb;
  v_n int;
  v_val text;
  v_ok boolean;
  v_area text;
  v_score int := 0;
  v_total int := 0;
  v_items jsonb := '[]'::jsonb;
  v_areas jsonb := '{}'::jsonb;
  v_result jsonb;
begin
  begin
    v_a := public.solo_assignment_for(p_token, p_assignment);
  exception when others then
    return jsonb_build_object('error', case when sqlerrm like '%expired%' then 'expired' else 'not_found' end);
  end;
  select s into v_step from public.solo_lessons l, jsonb_array_elements(l.steps) with ordinality as x(s, n)
   where l.id = v_a.lesson_id and n = p_step + 1;
  if v_step is null or v_step->>'t' <> 'test' then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- 이미 낸 시험이면 처음 결과 그대로(다시 풀어 점수를 바꿀 수 없다)
  select * into v_prev from public.solo_test_results where assignment_id = v_a.id and step_index = p_step;
  if v_prev.id is not null then
    return v_prev.result;
  end if;

  for v_item, v_n in select i, n from jsonb_array_elements(coalesce(v_step->'items', '[]'::jsonb)) with ordinality as x(i, n) loop
    v_val := nullif(btrim(coalesce(p_answers->>(v_n - 1)::int, '')), '');
    if v_val is null then
      v_ok := false;
    else
      begin
        v_ok := coalesce(public.solo_grade(v_item, v_val), false);
      exception when others then
        v_ok := false;
      end;
    end if;
    v_area := coalesce(nullif(v_item->>'area', ''), 'vocab');
    v_total := v_total + 1;
    if v_ok then
      v_score := v_score + 1;
    end if;
    v_areas := jsonb_set(v_areas, array[v_area], jsonb_build_object(
      'right', coalesce((v_areas->v_area->>'right')::int, 0) + case when v_ok then 1 else 0 end,
      'total', coalesce((v_areas->v_area->>'total')::int, 0) + 1));
    v_items := v_items || jsonb_build_array(jsonb_build_object('correct', v_ok, 'answer', public.solo_correct_text(v_item)));
    -- 문제마다 기록(시험 단계 번호 + 그 문제의 낱말)
    insert into public.solo_step_events (assignment_id, step_index, step_type, kind, correct, value, word)
    values (v_a.id, p_step, v_item->>'t', 'answer', v_ok, left(coalesce(v_val, ''), 80), public.solo_step_word(v_item));
  end loop;

  v_result := jsonb_build_object('score', v_score, 'total', v_total, 'by_area', v_areas, 'items', v_items);
  insert into public.solo_test_results (assignment_id, step_index, answers, result, score, total)
  values (v_a.id, p_step, coalesce(p_answers, '[]'::jsonb), v_result, v_score, v_total)
  on conflict (assignment_id, step_index) do nothing;

  -- 시험 단계를 끝낸 것으로(진행 기록)
  select jsonb_array_length(l.steps) into v_total_steps from public.solo_lessons l where l.id = v_a.lesson_id;
  update public.solo_assignments
     set progress = greatest(progress, p_step + 1),
         finished_at = case when p_step + 1 >= v_total_steps then coalesce(finished_at, now()) else finished_at end
   where id = v_a.id;
  return v_result;
end $$;

-- ---------- 5) (선생님) 이 수업의 시험 결과 ----------
create or replace function public.solo_test_summary(p_lesson uuid)
returns table (assignment_id uuid, step_index int, score int, total int, by_area jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.solo_lessons where id = p_lesson and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return query
    select r.assignment_id, r.step_index, r.score, r.total, r.result->'by_area', r.created_at
      from public.solo_test_results r
      join public.solo_assignments a on a.id = r.assignment_id
     where a.lesson_id = p_lesson
     order by r.assignment_id, r.step_index;
end $$;

-- ---------- 6) 시험을 내기 전에는 시험 단계를 건너뛸 수 없게 ----------
create or replace function public.solo_advance(p_token uuid, p_assignment uuid, p_step int, p_unsure boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_l public.solo_lessons;
  v_step jsonb;
  v_total int;
  v_done boolean;
begin
  v_a := public.solo_assignment_for(p_token, p_assignment);
  select * into v_l from public.solo_lessons where id = v_a.lesson_id;
  v_total := jsonb_array_length(v_l.steps);
  if p_step < 0 or p_step >= v_total then
    raise exception 'not_found';
  end if;
  v_step := v_l.steps->p_step;
  if v_step->>'t' = 'test' and not exists (select 1 from public.solo_test_results where assignment_id = v_a.id and step_index = p_step) then
    raise exception 'test_not_submitted';
  end if;
  insert into public.solo_step_events (assignment_id, step_index, step_type, kind)
  values (v_a.id, p_step, v_step->>'t', case when p_unsure then 'unsure' else 'seen' end);
  v_done := p_step + 1 >= v_total;
  update public.solo_assignments
     set progress = greatest(progress, p_step + 1),
         finished_at = case when v_done then coalesce(finished_at, now()) else finished_at end
   where id = v_a.id;
  return jsonb_build_object('answer', case when p_unsure then public.solo_correct_text(v_step) end, 'done', v_done);
end $$;

-- ---------- 권한 ----------
revoke all on function public.solo_public_step(jsonb) from public, anon, authenticated;
revoke all on function public.solo_test_submit(uuid, uuid, int, jsonb) from public, anon, authenticated;
revoke all on function public.solo_test_summary(uuid) from public, anon, authenticated;
revoke all on function public.solo_advance(uuid, uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.solo_test_submit(uuid, uuid, int, jsonb) to anon, authenticated;
grant execute on function public.solo_test_summary(uuid) to authenticated;
grant execute on function public.solo_advance(uuid, uuid, int, boolean) to anon, authenticated;

-- 확인(읽기 전용): 모두 true 여야 한다
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'solo_test_results') = 1 as table_ok,
  (select count(*) from pg_proc where proname in ('solo_test_submit', 'solo_test_summary')) = 2 as functions_ok,
  not has_table_privilege('anon', 'public.solo_test_results', 'select') as results_hidden_from_anon,
  (public.solo_public_step('{"t":"test","title":"x","items":[{"t":"pickMeaning","word":"dog","options":["개","고양이"],"answer":0,"area":"vocab","sec":20},{"t":"typeWord","word":"cat","meaning":"고양이","length":3,"first":"c","area":"spelling","sec":30}]}'::jsonb)
     -> 'items' -> 0 ? 'answer') = false as test_answer_stripped,
  (public.solo_public_step('{"t":"test","title":"x","items":[{"t":"typeWord","word":"cat","meaning":"고양이","length":3,"first":"c","area":"spelling","sec":30}]}'::jsonb)
     -> 'items' -> 0 ? 'word') = false as test_word_stripped,
  (public.solo_public_step('{"t":"test","title":"x","items":[{"t":"pickMeaning","word":"dog","options":["a","b"],"answer":1,"area":"vocab","sec":20}]}'::jsonb)
     -> 'items' -> 0 ->> 'area') = 'vocab' as test_area_kept;
