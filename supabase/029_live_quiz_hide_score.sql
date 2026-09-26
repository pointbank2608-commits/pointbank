-- ============================================================
--  029: 퀴즈쇼 — 문제가 열려 있는 동안 학생 휴대폰 점수가 먼저 올라가
--  정답을 미리 알 수 있던 문제 수정(live_state 만 다시 만든다). 2026-09-26
--  028 을 실행한 뒤 SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.
-- ============================================================

-- ---------- 학생: 지금 화면 ----------
-- 정답(correctIndex/answer)은 문제가 열려 있는 동안 빼고 보낸다.
create or replace function public.live_state(p_token uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  p public.live_players;
  s public.live_sessions;
  q jsonb;
  safe jsonb;
  mine public.live_answers;
  v_total int;
  v_rank int;
  v_players int;
  v_buzz int;
  v_hide boolean := false;
begin
  select * into p from public.live_players where token = p_token;
  if p.id is null then
    return json_build_object('error', 'no_player');
  end if;
  select * into s from public.live_sessions where id = p.session_id;
  if s.ended_at is not null then
    return json_build_object('phase', 'ended', 'title', s.title, 'nickname', p.nickname);
  end if;
  if s.q_index >= 0 and s.q_index < jsonb_array_length(s.questions) then
    q := s.questions -> s.q_index;
    safe := jsonb_build_object(
      'kind', q -> 'kind', 'prompt', q -> 'prompt', 'imageUrl', q -> 'imageUrl',
      'choices', q -> 'choices', 'seconds', q -> 'seconds', 'round', q -> 'round');
    if s.phase <> 'question' then
      safe := safe || jsonb_build_object('correctIndex', q -> 'correctIndex', 'answer', q -> 'answer');
    end if;
    select * into mine from public.live_answers where player_id = p.id and q_index = s.q_index;
  end if;
  -- 문제가 열려 있는 동안엔 지금 문제 점수를 빼고 센다(점수가 오르는 걸 보고 정답을 미리 알지 않게).
  -- 부저는 선생님이 그 자리에서 판정하니 바로 반영.
  v_hide := s.phase = 'question' and coalesce(q ->> 'kind', 'choice') <> 'buzzer';
  select coalesce(sum(points), 0) into v_total from public.live_answers
   where player_id = p.id and not (v_hide and q_index = s.q_index);
  select count(*) + 1 into v_rank from (
    select pl.id, coalesce(sum(a.points), 0) as total
      from public.live_players pl
      left join public.live_answers a on a.player_id = pl.id and not (v_hide and a.q_index = s.q_index)
     where pl.session_id = s.id group by pl.id
  ) x where x.total > v_total;
  select count(*) into v_players from public.live_players where session_id = s.id;
  if mine.id is not null and q ->> 'kind' = 'buzzer' then
    select count(*) + 1 into v_buzz from public.live_answers
     where session_id = s.id and q_index = s.q_index and answered_at < mine.answered_at;
  end if;
  return json_build_object(
    'title', s.title,
    'phase', s.phase,
    'q_index', s.q_index,
    'q_count', jsonb_array_length(s.questions),
    'question', safe,
    'started_at', s.q_started_at,
    'server_now', clock_timestamp(),
    'nickname', p.nickname,
    'score', v_total,
    'rank', v_rank,
    'players', v_players,
    'my_answer', case when mine.id is null then null else json_build_object(
      'choice', mine.choice,
      'text', mine.answer,
      'correct', case when s.phase <> 'question' or q ->> 'kind' = 'buzzer' then mine.correct end,
      'points', case when s.phase <> 'question' or q ->> 'kind' = 'buzzer' then mine.points end,
      'buzz_order', v_buzz) end
  );
end $$;
