-- ============================================================
-- 065 개별수업 새 문제 모양 "단어 배열 영작"(orderWrite)·"조건 영작"(condWrite) (2026-10-12)
--
--  - orderWrite : 우리말 뜻(ko)을 보고 주어진 낱말(words)로 영어 문장을 쓴다. 정답(answer)은 학생에게 안 간다.
--                 채점은 어법 오류 고치기와 같다(대소문자·문장부호 무시, " / " 로 이은 대체 정답).
--  - condWrite  : 우리말을 조건(conditions)에 맞게 영작한다. 조건 중 낱말 포함(words)·단어 수(min/max)만 서버가 자동 검사한다(solo_cond_ok).
--                 의미가 맞는지는 서버가 알 수 없으므로 "조건을 지켰나"만 맞다/틀리다로 보고, 예시 답(model)은 풀고 나서 보여 주며,
--                 학생이 쓴 글은 길게(300자) 저장해 선생님이 solo_written_answers 로 보고 확인한다.
--  - solo_answer: 쓴 글을 80자 → 300자로 저장하고, 조건 영작을 맞히면 예시 답을 같이 돌려준다.
--  - 능력 이름표: orderWrite → sentence.order, condWrite 는 점수에 넣지 않는다(조건 검사는 의미를 보증하지 않으므로).
-- 실행: 064 다음에 이 파일 하나. 끝의 select 가 모두 true 여야 한다.
-- ============================================================

-- 조건 영작 자동 검사: words(어느 하나 포함)·min/max(단어 수)가 있는 조건을 모두 만족하나
create or replace function public.solo_cond_ok(p_conditions jsonb, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
declare
  v text := public.solo_norm_loose(p_value);
  v_padded text;
  v_n int;
  c jsonb;
  w text;
  hit boolean;
begin
  if v = '' then
    return false;
  end if;
  v_padded := ' ' || v || ' ';
  v_n := cardinality(string_to_array(v, ' '));
  for c in select x from jsonb_array_elements(coalesce(p_conditions, '[]'::jsonb)) as t(x) loop
    if jsonb_typeof(c->'words') = 'array' and jsonb_array_length(c->'words') > 0 then
      hit := false;
      for w in select jsonb_array_elements_text(c->'words') loop
        if public.solo_norm_loose(w) <> '' and position(' ' || public.solo_norm_loose(w) || ' ' in v_padded) > 0 then
          hit := true;
        end if;
      end loop;
      if not hit then
        return false;
      end if;
    end if;
    if jsonb_typeof(c->'min') = 'number' and v_n < (c->>'min')::numeric then
      return false;
    end if;
    if jsonb_typeof(c->'max') = 'number' and v_n > (c->>'max')::numeric then
      return false;
    end if;
  end loop;
  return true;
end $$;

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
    when p->>'t' in ('spell', 'typeWord', 'gapType') then p - 'word'
    when p->>'t' = 'unscramble' then p - 'sentence'
    when p->>'t' = 'lineOrder' then p - 'lines'
    when p->>'t' = 'fixError' then p - 'right'
    when p->>'t' = 'orderWrite' then p - 'answer'
    when p->>'t' = 'condWrite' then p - 'model'
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

create or replace function public.solo_grade(p_step jsonb, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick', 'pickPos') then
    return (p_step->>'answer')::int = nullif(p_value, '')::int;
  elsif p_step->>'t' in ('spell', 'typeWord', 'dictation', 'gapType') then
    return public.solo_norm(p_step->>'word') = public.solo_norm(p_value);
  elsif p_step->>'t' = 'unscramble' then
    return public.solo_norm(p_step->>'sentence') = public.solo_norm(p_value);
  elsif p_step->>'t' = 'lineOrder' then
    return public.solo_norm((select string_agg(l, ' ' order by n) from jsonb_array_elements_text(p_step->'lines') with ordinality as x(l, n)))
         = public.solo_norm(p_value);
  elsif p_step->>'t' = 'fixError' then
    return public.solo_fix_matches(p_step->>'right', p_value);
  elsif p_step->>'t' = 'orderWrite' then
    return public.solo_fix_matches(p_step->>'answer', p_value);
  elsif p_step->>'t' = 'condWrite' then
    return public.solo_cond_ok(p_step->'conditions', p_value);
  end if;
  return null;
end $$;

create or replace function public.solo_correct_text(p_step jsonb) returns text
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick', 'pickPos') then
    return p_step->'options'->>((p_step->>'answer')::int);
  elsif p_step->>'t' in ('spell', 'typeWord', 'dictation', 'gapType') then
    return p_step->>'word';
  elsif p_step->>'t' = 'unscramble' then
    return p_step->>'sentence';
  elsif p_step->>'t' = 'lineOrder' then
    return (select string_agg(l, ' / ' order by n) from jsonb_array_elements_text(p_step->'lines') with ordinality as x(l, n));
  elsif p_step->>'t' = 'fixError' then
    return p_step->>'right';
  elsif p_step->>'t' = 'orderWrite' then
    return p_step->>'answer';
  elsif p_step->>'t' = 'condWrite' then
    return p_step->>'model';
  end if;
  return null;
end $$;

-- 능력 이름표: 064 의 함수에 orderWrite 한 줄(condWrite 는 점수에 넣지 않는다)
create or replace function public.solo_step_skill(p jsonb) returns text
language sql immutable set search_path = public
as $$
  select case p->>'t'
    when 'pickWord' then case when nullif(p->>'imageUrl', '') is not null then 'vocab.picture' else 'vocab.meaning' end
    when 'pickMeaning' then 'vocab.meaning'
    when 'fillBlank' then 'vocab.context'
    when 'gapType' then 'vocab.context'
    when 'pickPos' then 'vocab.pos'
    when 'spell' then 'vocab.spelling'
    when 'typeWord' then 'vocab.spelling'
    when 'listenPick' then 'listening.word'
    when 'dictation' then 'listening.dictation'
    when 'lyricBlank' then 'listening.content'
    when 'translatePick' then 'reading.sentence'
    when 'sayPick' then 'reading.situation'
    when 'unscramble' then 'sentence.order'
    when 'lineOrder' then 'sentence.order'
    when 'orderWrite' then 'sentence.order'
    when 'pickCorrect' then 'sentence.correct'
    when 'fixError' then 'sentence.correct'
    else null
  end
$$;

-- 답 내기: 쓴 글을 300자까지 저장하고, 조건 영작을 맞히면 예시 답을 같이 돌려준다
create or replace function public.solo_answer(p_token uuid, p_assignment uuid, p_step int, p_value text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_step jsonb;
  v_ok boolean;
begin
  v_a := public.solo_assignment_for(p_token, p_assignment);
  select s into v_step from public.solo_lessons l, jsonb_array_elements(l.steps) with ordinality as x(s, n)
   where l.id = v_a.lesson_id and n = p_step + 1;
  if v_step is null then
    raise exception 'not_found';
  end if;
  v_ok := public.solo_grade(v_step, p_value);
  insert into public.solo_step_events (assignment_id, step_index, step_type, kind, correct, value)
  values (v_a.id, p_step, v_step->>'t', 'answer', v_ok, left(p_value, 300));
  return jsonb_build_object(
    'correct', coalesce(v_ok, true),
    'model', case when v_ok is true and v_step->>'t' = 'condWrite' then v_step->>'model' end
  );
end $$;

-- (선생님) 이 수업에서 학생이 쓴 글 — 학생·단계마다 마지막 답과 시도 횟수
create or replace function public.solo_written_answers(p_lesson uuid)
returns table (assignment_id uuid, student_name text, step_index int, step_type text, value text, correct boolean, attempts int, answered_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.solo_lessons where id = p_lesson and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return query
    with ev as (
      select e.assignment_id, e.step_index, e.step_type, e.value, e.correct, e.created_at, e.id
        from public.solo_step_events e
        join public.solo_assignments a on a.id = e.assignment_id
       where a.lesson_id = p_lesson and e.kind = 'answer' and e.step_type in ('condWrite', 'orderWrite')
    ),
    lastans as (
      select distinct on (ev.assignment_id, ev.step_index) ev.*
        from ev
       order by ev.assignment_id, ev.step_index, ev.id desc
    ),
    cnt as (
      select ev.assignment_id, ev.step_index, count(*)::int as n from ev group by ev.assignment_id, ev.step_index
    )
    select l.assignment_id, s.name, l.step_index, l.step_type, l.value, l.correct, c.n, l.created_at
      from lastans l
      join cnt c on c.assignment_id = l.assignment_id and c.step_index = l.step_index
      join public.solo_assignments a on a.id = l.assignment_id
      join public.students s on s.id = a.student_id
     order by s.name, l.step_index;
end $$;

revoke all on function public.solo_cond_ok(jsonb, text) from public, anon, authenticated;
revoke all on function public.solo_public_step(jsonb) from public, anon, authenticated;
revoke all on function public.solo_grade(jsonb, text) from public, anon, authenticated;
revoke all on function public.solo_correct_text(jsonb) from public, anon, authenticated;
revoke all on function public.solo_step_skill(jsonb) from public, anon, authenticated;
revoke all on function public.solo_written_answers(uuid) from public, anon, authenticated;
grant execute on function public.solo_written_answers(uuid) to authenticated;
revoke all on function public.solo_answer(uuid, uuid, int, text) from public, anon, authenticated;
grant execute on function public.solo_answer(uuid, uuid, int, text) to anon, authenticated;

-- 확인(읽기 전용): 모두 true 여야 한다
select
  (public.solo_public_step('{"t":"orderWrite","ko":"x","words":["a","b"],"answer":"a b"}'::jsonb) ? 'answer') = false as order_answer_stripped,
  (public.solo_public_step('{"t":"condWrite","ko":"x","conditions":[{"text":"t"}],"model":"m"}'::jsonb) ? 'model') = false as model_stripped,
  (public.solo_public_step('{"t":"condWrite","ko":"x","conditions":[{"text":"t"}],"model":"m"}'::jsonb) -> 'conditions' -> 0 ->> 'text') = 't' as conditions_kept,
  public.solo_grade('{"t":"orderWrite","answer":"I like red apples."}'::jsonb, 'i like red apples') as order_graded,
  public.solo_grade('{"t":"orderWrite","answer":"I like red apples."}'::jsonb, 'red apples like I') = false as order_wrong,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"7단어","min":7,"max":7},{"text":"want","words":["want","wants"]}]}'::jsonb, 'I want to learn English very much') as cond_met,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"7단어","min":7,"max":7},{"text":"want","words":["want","wants"]}]}'::jsonb, 'I want to learn English') = false as cond_count_fails,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"7단어","min":4,"max":7},{"text":"want","words":["want","wants"]}]}'::jsonb, 'I like to learn English') = false as cond_word_fails,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"안내만"}]}'::jsonb, 'anything') as cond_no_check_passes,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"안내만"}]}'::jsonb, '   ') = false as cond_empty_fails,
  public.solo_correct_text('{"t":"condWrite","model":"I want to learn English."}'::jsonb) = 'I want to learn English.' as model_text,
  public.solo_step_skill('{"t":"orderWrite"}'::jsonb) = 'sentence.order' as order_skill,
  public.solo_step_skill('{"t":"condWrite"}'::jsonb) is null as cond_unscored,
  public.solo_step_skill('{"t":"fixError"}'::jsonb) = 'sentence.correct' as old_skill_kept;
