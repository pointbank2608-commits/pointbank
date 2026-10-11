-- 062: 개별수업 새 단계 gapType(빈칸 쓰기)·lineOrder(줄 순서 맞추기, 061)에도 능력 이름표를 붙인다.
--   gapType   → vocab.context   (문장 속 낱말을 직접 써서 채움 — 예문 빈칸 고르기의 쓰기 버전)
--   lineOrder → sentence.order  (문장·줄 순서)
-- 060 의 solo_step_skill 과 같고 위 두 줄만 더했다. 앞으로 새 채점 단계는 이 함수에 한 줄 + 앱 stats.ts 를 같이 고친다.

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
    else null
  end
$$;

-- 이미 쌓인 기록 중 이름표가 비어 있는 새 단계 기록을 채운다
update public.solo_step_events e
   set skill = public.solo_event_skill(e.assignment_id, e.step_index, e.step_type, e.word)
 where e.skill is null and e.kind in ('answer', 'unsure') and e.step_type in ('gapType', 'lineOrder');

revoke all on function public.solo_step_skill(jsonb) from public, anon, authenticated;
