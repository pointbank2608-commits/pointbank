-- ============================================================
-- 064 개별수업 새 문제 모양 "어법 오류 고치기"(fixError, 2026-10-12)
--
--  - 틀린 문장(wrong)을 학생에게 보여 주고, 학생이 고친 문장을 낸다. 정답은 고친 문장(right).
--  - 채점은 대소문자·문장부호·따옴표 모양을 무시한다(solo_norm_loose) — 학생이 마침표를 빼도, 대문자를 안 써도 맞게 본다.
--  - right 는 학생에게 안 간다. why(이유)와 wrong 은 간다(풀고 나서 보여 줌, 수업의 맞는 문장 고르기와 같은 방식).
--  - 능력 이름표: fixError → sentence.correct (맞는 문장 고르기와 같은 능력). 062 의 solo_step_skill 에 한 줄만 더했다.
-- 실행: 061·062 다음에 이 파일 하나. 끝의 select 가 모두 true 여야 한다.
-- ============================================================

-- 대소문자·문장부호를 무시한 비교용 글(영문자·숫자·작은따옴표만 남기고 나머지는 공백)
create or replace function public.solo_norm_loose(p text) returns text
language sql immutable set search_path = public
as $$
  select btrim(regexp_replace(lower(replace(replace(coalesce(p, ''), '’', ''''), '‘', '''')), '[^a-z0-9'']+', ' ', 'g'))
$$;

-- 정답이 여러 개면 " / " 로 이어 쓴다. 뒤쪽 정답이 첫 정답과 같은 낱말로 시작하면 온전한 문장이라 그대로 같아야 맞고,
-- 다른 낱말로 시작하면 문장 일부(조각)라서 "맨 앞 낱말이 첫 정답과 같고 그 조각으로 끝나는" 답이 맞다(앱 fixAccepts 와 같은 규칙).
create or replace function public.solo_fix_matches(p_right text, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
declare
  v text := public.solo_norm_loose(p_value);
  v_first text;
  r record;
begin
  if v = '' then
    return false;
  end if;
  for r in
    select public.solo_norm_loose(a.alt) as alt, a.n
      from regexp_split_to_table(coalesce(p_right, ''), '\s+/\s+') with ordinality as a(alt, n)
     order by a.n
  loop
    if r.alt = '' then
      continue;
    end if;
    if r.n = 1 then
      v_first := r.alt;
    end if;
    if r.n = 1 or split_part(r.alt, ' ', 1) = split_part(v_first, ' ', 1) then
      -- 첫 정답이거나 온전한 문장인 대체 정답: 그대로 같아야 한다
      if v = r.alt then
        return true;
      end if;
    elsif v <> r.alt and right(v, length(r.alt) + 1) = ' ' || r.alt and split_part(v, ' ', 1) = split_part(v_first, ' ', 1) then
      -- 문장 일부(조각)인 대체 정답: 첫 정답과 같은 낱말로 시작하고 그 조각으로 끝나는 답
      return true;
    end if;
  end loop;
  return false;
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
  end if;
  return null;
end $$;

-- 능력 이름표: 062 의 함수에 fixError 한 줄
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
    when 'pickCorrect' then 'sentence.correct'
    when 'fixError' then 'sentence.correct'
    else null
  end
$$;

revoke all on function public.solo_norm_loose(text) from public, anon, authenticated;
revoke all on function public.solo_fix_matches(text, text) from public, anon, authenticated;
revoke all on function public.solo_public_step(jsonb) from public, anon, authenticated;
revoke all on function public.solo_grade(jsonb, text) from public, anon, authenticated;
revoke all on function public.solo_correct_text(jsonb) from public, anon, authenticated;
revoke all on function public.solo_step_skill(jsonb) from public, anon, authenticated;

-- 확인(읽기 전용): 모두 true 여야 한다
select
  (public.solo_public_step('{"t":"fixError","wrong":"He go to school.","right":"He goes to school.","why":"he 는 -es"}'::jsonb) ? 'right') = false as right_stripped,
  (public.solo_public_step('{"t":"fixError","wrong":"He go to school.","right":"He goes to school.","why":"he 는 -es"}'::jsonb) ->> 'wrong') = 'He go to school.' as wrong_kept,
  public.solo_grade('{"t":"fixError","right":"He goes to school."}'::jsonb, 'he goes to school') as graded_ignoring_case_and_period,
  public.solo_grade('{"t":"fixError","right":"I don''t like it."}'::jsonb, 'I don’t like it') as graded_curly_apostrophe,
  public.solo_grade('{"t":"fixError","right":"He goes to school."}'::jsonb, 'He go to school.') = false as wrong_answer,
  public.solo_grade('{"t":"fixError","right":"I need much water. / a lot of water."}'::jsonb, 'I need a lot of water.') as alt_fragment_accepted,
  public.solo_grade('{"t":"fixError","right":"I need much water. / a lot of water."}'::jsonb, 'I need much water') as alt_first_accepted,
  public.solo_grade('{"t":"fixError","right":"I need much water. / a lot of water."}'::jsonb, 'I need many water.') = false as alt_wrong,
  public.solo_correct_text('{"t":"fixError","right":"He goes to school."}'::jsonb) = 'He goes to school.' as correct_text,
  public.solo_step_skill('{"t":"fixError"}'::jsonb) = 'sentence.correct' as skill_tag,
  public.solo_step_skill('{"t":"gapType"}'::jsonb) = 'vocab.context' as old_skill_kept,
  (public.solo_public_step('{"t":"test","title":"x","items":[{"t":"fixError","wrong":"a b","right":"a c","why":"","ko":"","area":"sentence","sec":30}]}'::jsonb) -> 'items' -> 0 ? 'right') = false as test_items_stripped;
