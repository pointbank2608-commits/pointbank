-- 056: 개별수업 새 단계 "품사 고르기"(pickPos) — 낱말(또는 문장 속 표시된 낱말)이 명사·동사·형용사 …중 무엇인지 고른다.
-- 번호로 고르는 단계라 서버 채점 목록에 넣는다. 055(낱말 만나기 품사 채우기)의 내용도 그대로 포함하므로 055 를 따로 안 돌려도 된다.
-- 이 파일 하나를 실행하고, 끝의 확인 결과가 모두 true 인지 본다.

create or replace function public.solo_public_step(p jsonb) returns jsonb
language sql stable set search_path = public
as $$
  select case
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

create or replace function public.solo_grade(p_step jsonb, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick', 'pickPos') then
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
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick', 'pickPos') then
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

-- 확인(읽기 전용): 모두 true 여야 한다
select
  (public.solo_public_step('{"t":"pickPos","word":"dog","answer":0,"options":["명사","동사"]}'::jsonb) ? 'answer') = false as pickpos_answer_stripped,
  public.solo_grade('{"t":"pickPos","answer":1,"options":["명사","동사"]}'::jsonb, '1') as pickpos_graded,
  public.solo_correct_text('{"t":"pickPos","answer":1,"options":["명사","동사"]}'::jsonb) = '동사' as pickpos_correct_text,
  (public.solo_public_step('{"t":"meet","word":"apple","meaning":"사과"}'::jsonb) ->> 'pos') is not null as meet_pos_filled;
