-- ============================================================
--  028: 실시간 퀴즈쇼(보카 대회) — 2026-09-26
--
--  전자칠판(선생님)이 문제를 띄우고, 학생은 휴대폰으로 QR/입장 번호를 찍어 닉네임만 넣고 들어와
--  답한다. 학생은 로그인하지 않는다(계정·개인정보 없음). 그래서 학생 쪽은 테이블을 직접 읽지
--  못하고 아래 security definer 함수(live_join / live_state / live_submit)로만 드나든다 —
--  정답은 선생님이 "정답 공개"를 누르기 전까지 학생에게 가지 않는다.
--  선생님 화면은 로그인한 staff 라 RLS 로 세션·참가자·답을 직접 읽고(실시간 구독),
--  답 채점 고치기(주관식 "정답 인정", 부저 판정)·참가자 내보내기도 직접 한다.
--
--  SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  template_id uuid references public.game_templates(id) on delete set null,
  -- 휴대폰 숫자 자판으로 치기 쉬운 6자리 숫자
  code text not null,
  title text not null default '',
  -- 문제 전체(LiveQuestion[]). 시작할 때 복사해 두므로 도중에 템플릿을 고쳐도 대회는 그대로.
  questions jsonb not null default '[]'::jsonb,
  speed_bonus boolean not null default true,
  -- lobby | question | reveal | leaderboard | final
  phase text not null default 'lobby',
  q_index int not null default -1,
  q_started_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists live_sessions_code_idx on public.live_sessions (code) where ended_at is null;

create table if not exists public.live_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  nickname text not null,
  -- 학생 휴대폰이 들고 있는 비밀 열쇠(이걸로만 답을 낸다)
  token uuid not null default gen_random_uuid() unique,
  joined_at timestamptz not null default now()
);
create index if not exists live_players_session_idx on public.live_players (session_id);

create table if not exists public.live_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  player_id uuid not null references public.live_players(id) on delete cascade,
  q_index int not null,
  choice int,
  answer text,
  -- null = 아직 판정 전(부저)
  correct boolean,
  -- 맞으면 받을 점수(빠를수록 많이). 선생님이 정답 인정으로 바꾸면 points 가 이 값이 된다.
  potential int not null default 0,
  points int not null default 0,
  answered_at timestamptz not null default clock_timestamp(),
  unique (player_id, q_index)
);
create index if not exists live_answers_session_idx on public.live_answers (session_id, q_index);

alter table public.live_sessions enable row level security;
alter table public.live_players enable row level security;
alter table public.live_answers enable row level security;

drop policy if exists live_sessions_staff on public.live_sessions;
create policy live_sessions_staff on public.live_sessions
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

drop policy if exists live_players_staff on public.live_players;
create policy live_players_staff on public.live_players
  for all using (exists (
    select 1 from public.live_sessions s
    where s.id = session_id and s.academy_id = public.my_academy_id() and public.is_staff()
  ));

drop policy if exists live_answers_staff on public.live_answers;
create policy live_answers_staff on public.live_answers
  for all using (exists (
    select 1 from public.live_sessions s
    where s.id = session_id and s.academy_id = public.my_academy_id() and public.is_staff()
  ));

-- 선생님 화면 실시간 구독(참가자 입장·답 제출)
do $$
begin
  begin
    alter publication supabase_realtime add table public.live_players;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.live_answers;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;

-- ---------- 선생님: 대회 열기 ----------
create or replace function public.live_host_create(
  p_title text,
  p_questions jsonb,
  p_class_id uuid default null,
  p_template_id uuid default null,
  p_speed_bonus boolean default true
) returns public.live_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_row public.live_sessions;
begin
  if not public.is_staff() or public.my_academy_id() is null then
    raise exception 'not_staff';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'no_questions';
  end if;
  -- 오래 열려 있던 대회는 정리(하루 지난 것)
  update public.live_sessions set ended_at = now()
   where ended_at is null and created_at < now() - interval '1 day';
  loop
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from public.live_sessions where code = v_code and ended_at is null);
  end loop;
  insert into public.live_sessions (academy_id, class_id, template_id, code, title, questions, speed_bonus)
  values (public.my_academy_id(), p_class_id, p_template_id, v_code, coalesce(p_title, ''), p_questions, coalesce(p_speed_bonus, true))
  returning * into v_row;
  return v_row;
end $$;

-- ---------- 선생님: 단계 넘기기 ----------
-- 문제를 열 때(question) 시작 시각을 서버 시계로 찍어 둔다 — 빠르기 점수·부저 순서가 학생 휴대폰
-- 시계나 인터넷 속도가 아니라 서버 기준이 되게.
create or replace function public.live_host_set(p_session_id uuid, p_phase text, p_q_index int)
returns public.live_sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.live_sessions;
begin
  if p_phase not in ('lobby', 'question', 'reveal', 'leaderboard', 'final', 'ended') then
    raise exception 'bad_phase';
  end if;
  update public.live_sessions
     set phase = case when p_phase = 'ended' then phase else p_phase end,
         q_index = p_q_index,
         q_started_at = case when p_phase = 'question' then clock_timestamp() else q_started_at end,
         ended_at = case when p_phase = 'ended' then now() else ended_at end
   where id = p_session_id and academy_id = public.my_academy_id() and public.is_staff()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'not_found';
  end if;
  return v_row;
end $$;

-- ---------- 학생: 입장 ----------
create or replace function public.live_join(p_code text, p_nickname text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_nick text := btrim(coalesce(p_nickname, ''));
  s public.live_sessions;
  p public.live_players;
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
  if s.phase = 'final' then
    raise exception 'finished';
  end if;
  if (select count(*) from public.live_players where session_id = s.id) >= 80 then
    raise exception 'full';
  end if;
  if exists (select 1 from public.live_players where session_id = s.id and lower(nickname) = lower(v_nick)) then
    raise exception 'nickname_taken';
  end if;
  insert into public.live_players (session_id, nickname) values (s.id, v_nick) returning * into p;
  return json_build_object('token', p.token, 'code', s.code, 'nickname', p.nickname);
end $$;

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

-- ---------- 학생: 답 내기(부저 누르기 포함) ----------
create or replace function public.live_submit(p_token uuid, p_q_index int, p_choice int default null, p_text text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  p public.live_players;
  s public.live_sessions;
  q jsonb;
  v_kind text;
  v_ok boolean;
  v_base int;
  v_secs int;
  v_elapsed double precision;
  v_pot int;
  v_norm text;
  v_id uuid;
begin
  select * into p from public.live_players where token = p_token;
  if p.id is null then
    raise exception 'no_player';
  end if;
  select * into s from public.live_sessions where id = p.session_id;
  if s.ended_at is not null or s.phase <> 'question' or s.q_index <> p_q_index then
    raise exception 'closed';
  end if;
  q := s.questions -> s.q_index;
  v_kind := coalesce(q ->> 'kind', 'choice');
  v_base := coalesce((q ->> 'points')::int, 1000);
  v_secs := greatest(coalesce((q ->> 'seconds')::int, 20), 3);
  v_elapsed := greatest(extract(epoch from clock_timestamp() - s.q_started_at), 0);
  if v_kind <> 'buzzer' and v_elapsed > v_secs + 2 then
    raise exception 'timeout';
  end if;

  if v_kind in ('choice', 'ox') then
    if p_choice is null then
      raise exception 'bad_answer';
    end if;
    v_ok := p_choice = coalesce((q ->> 'correctIndex')::int, -1);
  elsif v_kind = 'text' then
    v_norm := lower(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g'));
    if v_norm = '' then
      raise exception 'bad_answer';
    end if;
    v_ok := exists (
      select 1 from unnest(string_to_array(coalesce(q ->> 'answer', ''), '/')) a
       where lower(regexp_replace(btrim(a), '\s+', ' ', 'g')) = v_norm);
  else
    v_ok := null; -- 부저: 선생님이 판정
  end if;

  if v_kind = 'buzzer' or not s.speed_bonus then
    v_pot := v_base;
  else
    -- 바로 맞히면 만점, 시간이 다 돼 갈수록 절반까지
    v_pot := round(v_base * (1 - least(v_elapsed / v_secs, 1) / 2));
  end if;

  insert into public.live_answers (session_id, player_id, q_index, choice, answer, correct, potential, points)
  values (s.id, p.id, s.q_index, p_choice, nullif(btrim(coalesce(p_text, '')), ''), v_ok, v_pot,
          case when v_ok then v_pot else 0 end)
  on conflict (player_id, q_index) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'already';
  end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.live_join(text, text) from public;
revoke all on function public.live_state(uuid) from public;
revoke all on function public.live_submit(uuid, int, int, text) from public;
grant execute on function public.live_join(text, text) to anon, authenticated;
grant execute on function public.live_state(uuid) to anon, authenticated;
grant execute on function public.live_submit(uuid, int, int, text) to anon, authenticated;
grant execute on function public.live_host_create(text, jsonb, uuid, uuid, boolean) to authenticated;
grant execute on function public.live_host_set(uuid, text, int) to authenticated;
