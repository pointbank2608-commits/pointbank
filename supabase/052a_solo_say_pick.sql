-- ============================================================
-- 052a 개별수업: 끝 낱말부터 지우며 말하기(fadeRead) · 상황 보고 표현 고르기(sayPick) · 대화 역할극(roleplay) (2026-10-08)
--  - sayPick 은 번호로 고르는 단계(한국어 상황 → 알맞은 영어 표현). 서버 채점 목록에 넣는다.
--  - fadeRead·roleplay 는 채점 없는 말하기 단계. 녹음은 한 단계 안에서 여러 개(역할극은 학생 대사마다)를 둘 수 있게
--    solo_recordings 에 sub(단계 안 번호) 칸을 더한다. 기존 녹음은 sub = 0 그대로.
-- ============================================================

-- ---------- 단계 종류 ----------
create or replace function public.solo_public_step(p jsonb) returns jsonb
language sql immutable set search_path = public
as $$
  select case
    when p->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick') then p - 'answer'
    when p->>'t' in ('spell', 'typeWord') then p - 'word'
    when p->>'t' = 'unscramble' then p - 'sentence'
    else p
  end
$$;

create or replace function public.solo_grade(p_step jsonb, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick') then
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
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank', 'sayPick') then
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

-- 확인(읽기 전용): 둘 다 true
select
  (public.solo_public_step('{"t":"sayPick","options":["a","b"],"answer":1}'::jsonb) ? 'answer') = false as say_pick_stripped,
  public.solo_grade('{"t":"sayPick","options":["a","b"],"answer":1}'::jsonb, '1') as say_pick_grade;
