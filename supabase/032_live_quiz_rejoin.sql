-- ============================================================
--  032: 퀴즈쇼 — 창이 꺼지거나 나갔다가 다시 들어오기(재접속) 2026-09-28
--
--  문제: 휴대폰 창이 꺼진 뒤 다른 브라우저(카톡 QR·사파리 개인 정보 보호 모드 등)나 첫 화면(/join)
--  으로 다시 들어오면 휴대폰에 저장해 둔 열쇠(token)가 없어서 새로 입장해야 했는데, 같은 닉네임은
--  "이미 쓰고 있는 닉네임"으로 막혀 들어올 수 없었고, 다른 닉네임으로 들어오면 점수가 0부터였다.
--
--  고침: 같은 닉네임으로 다시 입장하면, 그 닉네임을 쓰던 휴대폰이 20초 넘게 조용하면(창이 꺼짐)
--  같은 참가자로 다시 들여보낸다 — 같은 열쇠를 돌려주므로 점수·답 기록이 그대로 이어진다.
--  지금도 화면을 보고 있는 휴대폰의 닉네임은 계속 막는다(다른 아이가 가로채지 못하게).
--  마지막 문제 뒤(final)에도 다시 들어와서 최종 순위를 볼 수 있다(새 참가자는 여전히 못 들어옴).
--
--  028·029 를 실행한 뒤 SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.
-- ============================================================

-- 휴대폰이 마지막으로 화면을 물어본 시각. live_players 에 두면 칸이 바뀔 때마다 선생님 칠판의 실시간 구독이
-- 울려서(수십 명 × 몇 초마다) 따로 둔다 — 실시간 발행(publication)에 넣지 않는다. 아래 함수로만 읽고 쓴다.
create table if not exists public.live_presence (
  player_id uuid primary key references public.live_players(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.live_presence enable row level security;

-- ---------- 학생: 입장(같은 닉네임이면 재접속) ----------
create or replace function public.live_join(p_code text, p_nickname text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_nick text := btrim(coalesce(p_nickname, ''));
  s public.live_sessions;
  p public.live_players;
  v_seen timestamptz;
begin
  if char_length(v_nick) < 1 or char_length(v_nick) > 12 then
    raise exception 'bad_nickname';
  end if;
  select * into s from public.live_sessions
   where code = btrim(coalesce(p_code, '')) and ended_at is null and created_at > now() - interval '1 day'
   order by created_at desc limit 1;
  if s.id is null then
    raise exception 'no_session';
  end if;

  select * into p from public.live_players
   where session_id = s.id and lower(nickname) = lower(v_nick)
   for update;
  if p.id is not null then
    -- 20초 넘게 조용했으면 창이 꺼진 것 — 같은 참가자로 다시 들어온다(점수 유지)
    select last_seen_at into v_seen from public.live_presence where player_id = p.id;
    if v_seen > now() - interval '20 seconds' then
      raise exception 'nickname_taken';
    end if;
    insert into public.live_presence (player_id, last_seen_at) values (p.id, now())
    on conflict (player_id) do update set last_seen_at = excluded.last_seen_at;
    return json_build_object('token', p.token, 'code', s.code, 'nickname', p.nickname, 'rejoined', true);
  end if;

  if s.phase = 'final' then
    raise exception 'finished';
  end if;
  if (select count(*) from public.live_players where session_id = s.id) >= 80 then
    raise exception 'full';
  end if;
  insert into public.live_players (session_id, nickname) values (s.id, v_nick) returning * into p;
  insert into public.live_presence (player_id, last_seen_at) values (p.id, now());
  return json_build_object('token', p.token, 'code', s.code, 'nickname', p.nickname, 'rejoined', false);
end $$;

-- ---------- 학생: 지금 화면(휴대폰이 살아 있다는 표시 추가) ----------
-- 029 와 같고, 맨 앞에 live_presence 기록만 더했다.
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
  -- 이 휴대폰이 아직 보고 있다는 표시(5초에 한 번만 써서 쓰기 부담을 줄인다) — live_join 이 "창이 꺼진 사람"을 알아보는 데 쓴다
  insert into public.live_presence (player_id, last_seen_at) values (p.id, now())
  on conflict (player_id) do update set last_seen_at = excluded.last_seen_at
   where public.live_presence.last_seen_at < now() - interval '5 seconds';
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

revoke all on function public.live_join(text, text) from public;
revoke all on function public.live_state(uuid) from public;
grant execute on function public.live_join(text, text) to anon, authenticated;
grant execute on function public.live_state(uuid) to anon, authenticated;
