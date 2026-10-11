-- ============================================================
-- 061 개별수업 글 블록 — 새 문제 모양 2가지(2026-10-12)
--
--  - gapType  : 가사·대사 빈칸 쓰기. 문장 속 빈칸에 들어갈 낱말을 직접 쓴다(정답 word, 학생에게는 글자 수·첫 글자만).
--  - lineOrder: 줄 순서 맞추기. lines 는 정답 순서(학생에게 안 간다), pieces 는 섞인 순서. 학생은 pieces 를 고른 순서대로
--               공백으로 이어 보내고, 서버는 lines 를 공백으로 이은 것과 비교한다.
-- 둘 다 서버가 채점한다(solo_grade). 058 의 시험 블록 안에서도 같은 함수가 문제마다 쓰이므로 시험에도 넣을 수 있다.
-- 실행: 060(스탯) 다음에 이 파일 하나. 060 은 위 세 함수를 건드리지 않아 순서는 상관없다. 끝의 select 가 모두 true 여야 한다.
-- ============================================================

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
  end if;
  return null;
end $$;

revoke all on function public.solo_public_step(jsonb) from public, anon, authenticated;
revoke all on function public.solo_grade(jsonb, text) from public, anon, authenticated;
revoke all on function public.solo_correct_text(jsonb) from public, anon, authenticated;

-- 확인(읽기 전용): 모두 true 여야 한다
select
  (public.solo_public_step('{"t":"gapType","sentence":"I _____ it","word":"love","length":4,"first":"l"}'::jsonb) ? 'word') = false as gap_word_stripped,
  (public.solo_public_step('{"t":"gapType","sentence":"I _____ it","word":"love","length":4,"first":"l"}'::jsonb) ->> 'first') = 'l' as gap_hint_kept,
  public.solo_grade('{"t":"gapType","word":"love"}'::jsonb, '  Love ') as gap_graded,
  public.solo_grade('{"t":"gapType","word":"love"}'::jsonb, 'like') = false as gap_wrong,
  (public.solo_public_step('{"t":"lineOrder","lines":["a b","c d"],"pieces":["c d","a b"]}'::jsonb) ? 'lines') = false as lines_stripped,
  public.solo_grade('{"t":"lineOrder","lines":["I am Mina.","I am seven."],"pieces":["I am seven.","I am Mina."]}'::jsonb, 'I am Mina. I am seven.') as order_graded,
  public.solo_grade('{"t":"lineOrder","lines":["I am Mina.","I am seven."],"pieces":["I am seven.","I am Mina."]}'::jsonb, 'I am seven. I am Mina.') = false as order_wrong,
  public.solo_correct_text('{"t":"lineOrder","lines":["x y","z"]}'::jsonb) = 'x y / z' as order_text,
  public.solo_correct_text('{"t":"pickPos","answer":1,"options":["명사","동사"]}'::jsonb) = '동사' as old_types_still_work,
  (public.solo_public_step('{"t":"test","title":"x","items":[{"t":"gapType","sentence":"a _____","word":"b","length":1,"first":"b","area":"sentence","sec":20}]}'::jsonb) -> 'items' -> 0 ? 'word') = false as test_items_stripped;
