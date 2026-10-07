-- 049 개별수업 새 단계 3종(쓰기 중심, 중학생용) — 047 의 채점·공개 함수를 넓힌다 (2026-10-07)
--  typeWord  : 뜻(+그림)을 보고 영어 단어를 키보드로 쓰기       정답 = word,  학생에게는 word 를 빼고 첫 글자·글자 수만
--  fillBlank : 예문의 빈칸에 들어갈 낱말 고르기                 정답 = answer(보기 번호), 학생에게는 answer 를 뺀다
--  dictation : 소리를 듣고 받아쓰기                              정답 = word (읽어 줄 word 가 필요해 학생에게도 남는다)
create or replace function public.solo_public_step(p jsonb) returns jsonb
language sql immutable set search_path = public
as $$
  select case
    when p->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank') then p - 'answer'
    when p->>'t' in ('spell', 'typeWord') then p - 'word'
    else p
  end
$$;

create or replace function public.solo_grade(p_step jsonb, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank') then
    return (p_step->>'answer')::int = nullif(p_value, '')::int;
  elsif p_step->>'t' in ('spell', 'typeWord', 'dictation') then
    return public.solo_norm(p_step->>'word') = public.solo_norm(p_value);
  end if;
  return null;
end $$;

create or replace function public.solo_correct_text(p_step jsonb) returns text
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank') then
    return p_step->'options'->>((p_step->>'answer')::int);
  elsif p_step->>'t' in ('spell', 'typeWord', 'dictation') then
    return p_step->>'word';
  end if;
  return null;
end $$;

revoke all on function public.solo_public_step(jsonb) from public, anon, authenticated;
revoke all on function public.solo_grade(jsonb, text) from public, anon, authenticated;
revoke all on function public.solo_correct_text(jsonb) from public, anon, authenticated;

-- 확인(읽기 전용): 셋 다 true
select
  (public.solo_public_step('{"t":"typeWord","word":"apple","length":5}'::jsonb) ? 'word') = false as type_word_stripped,
  public.solo_grade('{"t":"dictation","word":"Apple"}'::jsonb, ' apple ') as dictation_grade,
  public.solo_grade('{"t":"fillBlank","options":["a","b"],"answer":1}'::jsonb, '1') as fill_blank_grade;
