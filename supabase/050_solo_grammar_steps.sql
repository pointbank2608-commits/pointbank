-- 050 개별수업 단계 종류 최종 정리 — 쓰기 중심 단어(049)와 문법 단계까지 한 번에 (2026-10-07)
--  이 파일은 049 를 대신해도 되고(049 를 안 돌렸어도 됨), 이미 049 를 돌렸어도 다시 돌려도 된다(create or replace).
--
--  번호로 고르는 단계: pickWord · pickMeaning · listenPick · fillBlank · translatePick · pickCorrect
--     정답 = answer(보기 번호). 학생에게는 answer 를 뺀다. 듣고 고르기는 읽어 줄 word 가 남는다.
--  글자로 답하는 단계: spell · typeWord · dictation  (정답 = word; spell·typeWord 는 학생에게 word 를 뺀다)
--  문장 배열하기: unscramble (정답 = sentence; 학생에게는 sentence 를 빼고 섞인 words 만)
--  보기만 하는 단계: intro · meet · rule · example (채점 없음)
create or replace function public.solo_public_step(p jsonb) returns jsonb
language sql immutable set search_path = public
as $$
  select case
    when p->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect') then p - 'answer'
    when p->>'t' in ('spell', 'typeWord') then p - 'word'
    when p->>'t' = 'unscramble' then p - 'sentence'
    else p
  end
$$;

create or replace function public.solo_grade(p_step jsonb, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect') then
    return (p_step->>'answer')::int = nullif(p_value, '')::int;
  elsif p_step->>'t' in ('spell', 'typeWord', 'dictation') then
    return public.solo_norm(p_step->>'word') = public.solo_norm(p_value);
  elsif p_step->>'t' = 'unscramble' then
    return public.solo_norm(p_step->>'sentence') = public.solo_norm(p_value);
  end if;
  return null;
end $$;

create or replace function public.solo_correct_text(p_step jsonb) returns text
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect') then
    return p_step->'options'->>((p_step->>'answer')::int);
  elsif p_step->>'t' in ('spell', 'typeWord', 'dictation') then
    return p_step->>'word';
  elsif p_step->>'t' = 'unscramble' then
    return p_step->>'sentence';
  end if;
  return null;
end $$;

revoke all on function public.solo_public_step(jsonb) from public, anon, authenticated;
revoke all on function public.solo_grade(jsonb, text) from public, anon, authenticated;
revoke all on function public.solo_correct_text(jsonb) from public, anon, authenticated;

-- 확인(읽기 전용): 넷 다 true
select
  (public.solo_public_step('{"t":"typeWord","word":"apple","length":5}'::jsonb) ? 'word') = false as type_word_stripped,
  (public.solo_public_step('{"t":"unscramble","sentence":"I like it.","words":["it.","like","I"]}'::jsonb) ? 'sentence') = false as unscramble_stripped,
  public.solo_grade('{"t":"dictation","word":"Apple"}'::jsonb, ' apple ') as dictation_grade,
  public.solo_grade('{"t":"unscramble","sentence":"I like it."}'::jsonb, 'i like it.') as unscramble_grade;
