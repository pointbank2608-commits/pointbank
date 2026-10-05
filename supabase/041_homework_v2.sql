-- ============================================================
--  041: 학생 숙제 2단계 — 보안·구조 보강 + 활동(워크시트·게임·쉐도잉) + 학습 기록·스탯·추천 재료
--  2026-10-05. 040 은 이미 배포된 기록으로 두고, 여기서 앞으로만 바꾼다. 여러 번 실행해도 안전.
--
--  고치는 보안 문제
--   1) 정오답·점수·스킬을 학생 브라우저가 보내던 것 → 서버가 저장된 문제 스냅샷으로 채점(hw_submit)
--   2) 숙제 번호만으로 반 전체 명단(이름·id)을 주던 hw_open → 명단 없이. 학생은 이름 + PIN 을 직접 입력(hw_login_name)
--   3) PIN 평문 저장 → bcrypt 해시(student_hw_pins, 브라우저가 못 읽는 표). 선생님은 "새 PIN 만들기"로만 알 수 있다(hw_reset_pin, 한 번만 보임)
--   4) 마감·종료를 화면에서만 → 모든 학생용 함수가 서버에서 막는다
--   5) 같은 답이 두 번 기록 → client_id 로 한 번만(learning_events.client_id unique)
--   6) security definer 함수의 PUBLIC 실행 권한 회수, 필요한 역할에만
--   7) 학생을 지우면 기록이 사라짐 → 기록이 있는 학생은 지우는 대신 보관(archived_at)
--   8) 숙제를 낸 당시 대상 학생을 남긴다(homework_assignment_targets) — 나중에 들어온 학생이 미제출로 보이지 않게
--
--  새 구조
--   homework_assignment_targets : 숙제별 대상 학생 + 개인 링크 토큰
--   homework_items              : 숙제 안의 활동(quiz/worksheet/game/shadowing) 순서와 내용 스냅샷
--   homework_item_attempts      : 학생별 활동 시작·완료·점수·다시 풀기
--   learning_events             : 정답·오답·다시 풀기·쉐도잉·완료의 바뀌지 않는 원본 기록
--   집계 함수: hw_class_overview, hw_assignment_summary, student_learning_card, student_review_candidates,
--             academy_homework_usage(다음 단계 학생 좌석 요금의 사용량 경계 — 지금은 계산만, 결제·제한 없음)
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- 학생: PIN 해시 + 보관 ----------
-- 해시는 students 가 아니라 따로 둔 표에 — students 는 선생님 화면이 select('*') 로 읽어서, 같은 줄에 두면
-- 4자리 PIN 해시가 브라우저로 가고 금방 풀린다. 이 표는 RLS 정책이 없어 서버 함수만 읽는다.
create table if not exists public.student_hw_pins (
  student_id uuid primary key references public.students (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.student_hw_pins enable row level security;
revoke all on public.student_hw_pins from anon, authenticated;
alter table public.students add column if not exists archived_at timestamptz;
insert into public.student_hw_pins (student_id, pin_hash)
select id, extensions.crypt(hw_pin, extensions.gen_salt('bf', 8)) from public.students
 where hw_pin is not null
on conflict (student_id) do nothing;
update public.students set hw_pin = null where hw_pin is not null;
alter table public.students alter column hw_pin drop default;
create index if not exists students_class_active_idx on public.students (class_id) where archived_at is null;

-- 학습 기록이 있는 학생은 지우지 않고 보관한다(반을 지울 때처럼 다른 지우기에 딸려 오는 경우는 그대로 지운다)
create or replace function public.students_archive_instead_of_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 and (
       exists (select 1 from public.homework_attempts where student_id = old.id)
    or exists (select 1 from public.learning_events where student_id = old.id)
  ) then
    update public.students set archived_at = coalesce(archived_at, now()) where id = old.id;
    return null;
  end if;
  return old;
end $$;

-- 무료 플랜 학생 수(10명)는 보관 학생을 세지 않는다 — 결제·요금과 무관한 개수 계산만 고침
create or replace function public.check_free_tier_limits()
returns trigger
language plpgsql
as $$
declare
  v_plan  text;
  v_count int;
begin
  select plan into v_plan from public.academies where id = new.academy_id;
  if v_plan is distinct from 'free' then
    return new;
  end if;
  if tg_table_name = 'classes' then
    select count(*) into v_count from public.classes where academy_id = new.academy_id;
    if v_count >= 1 then
      raise exception '무료 플랜은 반을 1개까지만 만들 수 있어요. 유료 플랜으로 업그레이드하면 반을 더 만들 수 있어요.';
    end if;
  elsif tg_table_name = 'students' then
    select count(*) into v_count from public.students where academy_id = new.academy_id and archived_at is null;
    if v_count >= 10 then
      raise exception '무료 플랜은 학생을 10명까지만 등록할 수 있어요. 유료 플랜으로 업그레이드하면 더 등록할 수 있어요.';
    end if;
  end if;
  return new;
end;
$$;

-- ---------- 숙제: 종류·묶음·추천 기록 ----------
alter table public.homework_assignments add column if not exists kind text not null default 'class';
alter table public.homework_assignments add column if not exists group_id uuid;
alter table public.homework_assignments add column if not exists recommendation jsonb;
alter table public.homework_assignments add column if not exists target_count int;
do $$ begin
  alter table public.homework_assignments add constraint homework_assignments_kind_chk check (kind in ('class', 'selected', 'custom'));
exception when duplicate_object then null; end $$;

create table if not exists public.homework_assignment_targets (
  assignment_id uuid not null references public.homework_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  -- 학생별 개인 링크(/hw/p/토큰). 이름·학생 id 를 담지 않는 긴 임의 값
  access_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);
create index if not exists homework_targets_student_idx on public.homework_assignment_targets (student_id);

create table if not exists public.homework_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.homework_assignments(id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('quiz', 'worksheet', 'game', 'shadowing')),
  title text not null default '',
  -- 만들 때의 설정(예: 게임 종류, 워크시트 유형)
  config jsonb not null default '{}'::jsonb,
  -- 내용 스냅샷: { questions: [...정답 포함...], lines?: [...] } — 단어장을 고쳐도 숙제는 그대로
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (assignment_id, position)
);

create table if not exists public.homework_item_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.homework_attempts(id) on delete cascade,
  item_id uuid not null references public.homework_items(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int not null default 0,
  total int not null default 0,
  retry_count int not null default 0,
  -- 쉐도잉: { listens, repeats, lines } 같은 보조 기록
  meta jsonb not null default '{}'::jsonb,
  unique (attempt_id, item_id)
);
create index if not exists homework_item_attempts_attempt_idx on public.homework_item_attempts (attempt_id);

-- 답(문제마다 첫 답만 — 점수의 근거). 활동 id 를 더하고, 기존 답은 아래 이전 단계에서 첫 활동으로 옮긴다.
alter table public.homework_answers add column if not exists item_id uuid references public.homework_items(id) on delete cascade;
alter table public.homework_answers drop constraint if exists homework_answers_attempt_id_q_index_key;

-- 바뀌지 않는 학습 원본 기록
create table if not exists public.learning_events (
  id bigserial primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assignment_id uuid references public.homework_assignments(id) on delete set null,
  item_id uuid references public.homework_items(id) on delete set null,
  attempt_id uuid references public.homework_attempts(id) on delete set null,
  q_index int,
  -- answer(처음 답) · retry_answer(다시 풀기) · shadow_line · item_complete · assignment_complete
  event_type text not null check (event_type in ('answer', 'retry_answer', 'shadow_line', 'item_complete', 'assignment_complete')),
  skill text,
  word text,
  content_id text,
  difficulty int,
  correct boolean,
  response text,
  ms int,
  -- 문제의 낱말 카드 스냅샷(뜻·그림·예문) 등 — 추천 숙제를 만들 때 쓴다
  meta jsonb not null default '{}'::jsonb,
  -- 같은 요청이 두 번 와도 한 번만 남긴다
  client_id uuid unique,
  created_at timestamptz not null default now()
);
create index if not exists learning_events_student_idx on public.learning_events (student_id, created_at desc);
create index if not exists learning_events_academy_idx on public.learning_events (academy_id, created_at desc);
create index if not exists learning_events_attempt_idx on public.learning_events (attempt_id);

-- PIN 실패 기록: 이름(+숙제)별로 센다
alter table public.homework_pin_failures alter column student_id drop not null;
alter table public.homework_pin_failures add column if not exists fail_key text;
create index if not exists homework_pin_failures_key_idx on public.homework_pin_failures (fail_key, failed_at desc);

-- ---------- 기존 숙제 옮기기(한 번만, 다시 실행해도 그대로) ----------
-- 040 의 문제(LiveQuestion 모양)를 활동 1개(quiz)로. 정답 칸 이름을 서버 채점 형식(correct)으로 바꾼다.
insert into public.homework_items (assignment_id, position, kind, title, config, content)
select a.id, 0, 'quiz', '', jsonb_build_object('legacy', true),
       jsonb_build_object('questions', coalesce((
         select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', q->>'id',
           'qtype', case when q->>'kind' in ('choice', 'ox') then 'choice' else 'text' end,
           'prompt', q->>'prompt',
           'choices', case when q->>'kind' = 'ox' then '["O","X"]'::jsonb else q->'choices' end,
           'correct', case when q->>'kind' in ('choice', 'ox') then q->'correctIndex' else to_jsonb(q->>'answer') end,
           'imageUrl', coalesce(q->>'revealImage', q->>'imageUrl'),
           'speak', q->>'speak',
           'round', q->>'round',
           'skill', q->>'skill',
           'word', q->>'word',
           'difficulty', 1,
           'gen', 'legacy'
         )) order by ord)
         from jsonb_array_elements(a.questions) with ordinality as t(q, ord)
       ), '[]'::jsonb))
  from public.homework_assignments a
 where jsonb_array_length(a.questions) > 0
   and not exists (select 1 from public.homework_items i where i.assignment_id = a.id);

update public.homework_answers h
   set item_id = i.id
  from public.homework_attempts t
  join public.homework_items i on i.assignment_id = t.assignment_id and i.position = 0
 where h.attempt_id = t.id and h.item_id is null;

create unique index if not exists homework_answers_item_q_idx on public.homework_answers (attempt_id, item_id, q_index);

-- 기존 숙제의 대상 = 그 반 학생(보관 제외) + 이미 푼 학생
insert into public.homework_assignment_targets (assignment_id, student_id, token_expires_at)
select a.id, s.id, coalesce(a.due_at, a.created_at + interval '30 days') + interval '7 days'
  from public.homework_assignments a
  join public.students s on s.class_id = a.class_id and s.archived_at is null
on conflict do nothing;
insert into public.homework_assignment_targets (assignment_id, student_id, token_expires_at)
select t.assignment_id, t.student_id, coalesce(a.due_at, a.created_at + interval '30 days') + interval '7 days'
  from public.homework_attempts t
  join public.homework_assignments a on a.id = t.assignment_id
on conflict do nothing;
update public.homework_assignments a
   set target_count = (select count(*) from public.homework_assignment_targets t where t.assignment_id = a.id)
 where target_count is null;

-- 기존 답을 학습 기록으로(처음 답) — 스탯이 기존 숙제도 반영하게. client_id 가 없으니 이미 옮긴 것은 건너뛴다.
insert into public.learning_events (academy_id, student_id, assignment_id, item_id, attempt_id, q_index, event_type, skill, word, correct, response, ms, created_at)
select a.academy_id, t.student_id, a.id, h.item_id, t.id, h.q_index, 'answer', nullif(h.skill, ''), nullif(h.word, ''), h.correct, h.response, h.ms, h.answered_at
  from public.homework_answers h
  join public.homework_attempts t on t.id = h.attempt_id
  join public.homework_assignments a on a.id = t.assignment_id
 where not exists (select 1 from public.learning_events e where e.attempt_id = h.attempt_id and e.q_index = h.q_index and e.event_type = 'answer');

-- 이제 학생 삭제 트리거(learning_events 가 생긴 뒤)
drop trigger if exists students_archive_instead_of_delete on public.students;
create trigger students_archive_instead_of_delete
  before delete on public.students
  for each row execute function public.students_archive_instead_of_delete();

-- ---------- RLS(선생님은 자기 학원 것만) ----------
alter table public.homework_assignment_targets enable row level security;
alter table public.homework_items enable row level security;
alter table public.homework_item_attempts enable row level security;
alter table public.learning_events enable row level security;

drop policy if exists homework_targets_staff on public.homework_assignment_targets;
create policy homework_targets_staff on public.homework_assignment_targets
  for all using (exists (select 1 from public.homework_assignments a where a.id = assignment_id and a.academy_id = public.my_academy_id() and public.is_staff()));

drop policy if exists homework_items_staff on public.homework_items;
create policy homework_items_staff on public.homework_items
  for all using (exists (select 1 from public.homework_assignments a where a.id = assignment_id and a.academy_id = public.my_academy_id() and public.is_staff()));

drop policy if exists homework_item_attempts_staff on public.homework_item_attempts;
create policy homework_item_attempts_staff on public.homework_item_attempts
  for select using (exists (
    select 1 from public.homework_attempts t join public.homework_assignments a on a.id = t.assignment_id
     where t.id = attempt_id and a.academy_id = public.my_academy_id() and public.is_staff()));

-- 학습 원본은 읽기만(쓰기는 아래 함수만, 고치기·지우기 정책 없음)
drop policy if exists learning_events_staff_read on public.learning_events;
create policy learning_events_staff_read on public.learning_events
  for select using (academy_id = public.my_academy_id() and public.is_staff());

-- ---------- 도우미 ----------
create or replace function public.hw_norm(p text) returns text
language sql immutable as $$
  select lower(regexp_replace(regexp_replace(btrim(coalesce(p, '')), '[.!?]+$', ''), '\s+', ' ', 'g'))
$$;

-- 서버 채점: choice(보기 번호) · text(철자, '/'로 여러 답) · order(낱말·글자 순서, JSON 배열)
create or replace function public.hw_grade(q jsonb, r text) returns boolean
language plpgsql immutable as $$
declare
  v text;
begin
  if r is null then
    return false;
  end if;
  case coalesce(q->>'qtype', 'choice')
    when 'choice' then
      if r !~ '^\d+$' or q->>'correct' is null then
        return false;
      end if;
      return r::int = (q->>'correct')::int;
    when 'text' then
      foreach v in array string_to_array(coalesce(q->>'correct', ''), '/') loop
        if public.hw_norm(v) <> '' and public.hw_norm(v) = public.hw_norm(r) then
          return true;
        end if;
      end loop;
      return false;
    when 'order' then
      begin
        return (r::jsonb) = (q->'correct');
      exception when others then
        return false;
      end;
    else
      return false;
  end case;
end $$;

-- 학생에게 보여 줄 정답 글(채점한 뒤에만)
create or replace function public.hw_answer_text(q jsonb) returns text
language sql immutable as $$
  select case coalesce(q->>'qtype', 'choice')
    when 'choice' then q->'choices'->>((q->>'correct')::int)
    when 'text' then split_part(q->>'correct', '/', 1)
    when 'order' then (select string_agg(x, coalesce(q->>'joiner', ' ')) from jsonb_array_elements_text(q->'correct') as x)
  end
$$;

-- 학생에게 보내는 활동(정답 칸을 뺀다)
create or replace function public.hw_public_item(i public.homework_items) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', i.id, 'kind', i.kind, 'title', i.title, 'config', i.config,
    'content', (i.content - 'questions') || jsonb_build_object('questions', coalesce((
      select jsonb_agg(q - 'correct' order by ord) from jsonb_array_elements(coalesce(i.content->'questions', '[]'::jsonb)) with ordinality as t(q, ord)
    ), '[]'::jsonb))
  )
$$;

-- 학생 열쇠 → 숙제 확인(없음·닫힘·마감은 여기서 막는다)
drop function if exists public.hw_attempt_for(uuid);
-- p_read: 이미 끝낸 학생은 마감·기한이 지나도 결과(읽기)는 볼 수 있다. 답 내기는 막힌다.
create or replace function public.hw_attempt_for(p_token uuid, p_read boolean default false) returns public.homework_attempts
language plpgsql stable security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_a public.homework_assignments;
begin
  select * into v_t from public.homework_attempts where token = p_token;
  if v_t.id is null then
    raise exception 'not_found';
  end if;
  if p_read and v_t.finished_at is not null then
    return v_t;
  end if;
  select * into v_a from public.homework_assignments where id = v_t.assignment_id;
  if v_a.closed_at is not null then
    raise exception 'closed';
  end if;
  if v_a.due_at is not null and v_a.due_at < now() then
    raise exception 'past_due';
  end if;
  return v_t;
end $$;

create or replace function public.hw_staff_academy() returns uuid
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_staff() or public.my_academy_id() is null then
    raise exception 'not_staff';
  end if;
  return public.my_academy_id();
end $$;

-- ---------- 학생: 숙제 번호로 열기(명단 없이) ----------
create or replace function public.hw_open(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.homework_assignments;
begin
  select * into v_a from public.homework_assignments where code = btrim(p_code) order by (closed_at is null) desc, created_at desc limit 1;
  if v_a.id is null or v_a.kind = 'custom' then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'title', v_a.title,
    'class_name', (select name from public.classes where id = v_a.class_id),
    'due_at', v_a.due_at,
    'closed', v_a.closed_at is not null,
    'past_due', v_a.due_at is not null and v_a.due_at < now(),
    'count', (select coalesce(sum(jsonb_array_length(coalesce(content->'questions', '[]'::jsonb))), 0) from public.homework_items where assignment_id = v_a.id),
    'kinds', coalesce((select jsonb_agg(kind order by position) from public.homework_items where assignment_id = v_a.id), '[]'::jsonb)
  );
end $$;

-- ---------- 학생: 이름 + PIN → 열쇠. 틀리면 이름·PIN 어느 쪽인지 알려 주지 않는다 ----------
create or replace function public.hw_login_name(p_code text, p_name text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.homework_assignments;
  v_key text;
  v_sid uuid;
  v_name text;
  v_t public.homework_attempts;
  r record;
begin
  select * into v_a from public.homework_assignments where code = btrim(p_code) and kind <> 'custom' order by (closed_at is null) desc, created_at desc limit 1;
  if v_a.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_a.closed_at is not null then
    return jsonb_build_object('error', 'closed');
  end if;
  if v_a.due_at is not null and v_a.due_at < now() then
    return jsonb_build_object('error', 'past_due');
  end if;
  v_key := v_a.id::text || ':' || lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', '', 'g'));
  if (select count(*) from public.homework_pin_failures where fail_key = v_key and failed_at > now() - interval '10 minutes') >= 8
     or (select count(*) from public.homework_pin_failures where fail_key like v_a.id::text || ':%' and failed_at > now() - interval '10 minutes') >= 60 then
    return jsonb_build_object('error', 'locked');
  end if;
  for r in
    select s.id, s.name, p.pin_hash as hw_pin_hash
      from public.homework_assignment_targets g
      join public.students s on s.id = g.student_id
      left join public.student_hw_pins p on p.student_id = s.id
     where g.assignment_id = v_a.id and s.archived_at is null
       and lower(regexp_replace(btrim(s.name), '\s+', '', 'g')) = lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', '', 'g'))
  loop
    if r.hw_pin_hash is not null and extensions.crypt(btrim(coalesce(p_pin, '')), r.hw_pin_hash) = r.hw_pin_hash then
      v_sid := r.id;
      v_name := r.name;
      exit;
    end if;
  end loop;
  if v_sid is null then
    insert into public.homework_pin_failures (fail_key) values (v_key);
    return jsonb_build_object('error', 'bad_login');
  end if;
  insert into public.homework_attempts (assignment_id, student_id, total)
  values (v_a.id, v_sid, 0)
  on conflict (assignment_id, student_id) do update set last_seen_at = now()
  returning * into v_t;
  return jsonb_build_object('token', v_t.token, 'code', v_a.code);
end $$;

-- ---------- 학생: 개인 링크(QR) → 열쇠 ----------
create or replace function public.hw_open_personal(p_access text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_g public.homework_assignment_targets;
  v_a public.homework_assignments;
  v_t public.homework_attempts;
begin
  select * into v_g from public.homework_assignment_targets where access_token = btrim(coalesce(p_access, ''));
  if v_g.assignment_id is null or (v_g.token_expires_at is not null and v_g.token_expires_at < now()) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if exists (select 1 from public.students where id = v_g.student_id and archived_at is not null) then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into v_a from public.homework_assignments where id = v_g.assignment_id;
  if v_a.closed_at is not null then
    return jsonb_build_object('error', 'closed');
  end if;
  if v_a.due_at is not null and v_a.due_at < now() then
    return jsonb_build_object('error', 'past_due');
  end if;
  insert into public.homework_attempts (assignment_id, student_id, total)
  values (v_a.id, v_g.student_id, 0)
  on conflict (assignment_id, student_id) do update set last_seen_at = now()
  returning * into v_t;
  return jsonb_build_object('token', v_t.token, 'code', v_a.code);
end $$;

-- ---------- 학생: 숙제 내용(정답 없이) + 지금까지 한 것 ----------
create or replace function public.hw_state(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_a public.homework_assignments;
begin
  v_t := public.hw_attempt_for(p_token, true);
  select * into v_a from public.homework_assignments where id = v_t.assignment_id;
  update public.homework_attempts set last_seen_at = now() where id = v_t.id;
  return jsonb_build_object(
    'title', v_a.title,
    'name', (select name from public.students where id = v_t.student_id),
    'due_at', v_a.due_at,
    'finished', v_t.finished_at is not null,
    'items', coalesce((select jsonb_agg(public.hw_public_item(i) order by i.position) from public.homework_items i where i.assignment_id = v_a.id), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', h.item_id, 'q_index', h.q_index, 'correct', h.correct, 'response', h.response,
        'answer', public.hw_answer_text(i.content->'questions'->h.q_index)
      ) order by i.position, h.q_index)
      from public.homework_answers h join public.homework_items i on i.id = h.item_id
      where h.attempt_id = v_t.id
    ), '[]'::jsonb),
    'item_attempts', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', x.item_id, 'finished', x.finished_at is not null, 'score', x.score, 'total', x.total, 'meta', x.meta))
      from public.homework_item_attempts x where x.attempt_id = v_t.id
    ), '[]'::jsonb)
  );
end $$;

-- ---------- 학생: 답 하나(서버 채점, 같은 요청은 한 번만) ----------
create or replace function public.hw_submit(p_token uuid, p_item_id uuid, p_q_index int, p_response text, p_client_id uuid, p_ms int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_i public.homework_items;
  v_q jsonb;
  v_ok boolean;
  v_first boolean;
  v_e public.learning_events;
  v_academy uuid;
begin
  -- 같은 요청이 다시 오면 처음 결과를 그대로 돌려준다(네트워크 재시도)
  select * into v_e from public.learning_events where client_id = p_client_id;
  if v_e.id is not null then
    select * into v_i from public.homework_items where id = v_e.item_id;
    return jsonb_build_object('correct', v_e.correct, 'answer', public.hw_answer_text(v_i.content->'questions'->v_e.q_index), 'first', v_e.event_type = 'answer');
  end if;
  v_t := public.hw_attempt_for(p_token);
  select * into v_i from public.homework_items where id = p_item_id and assignment_id = v_t.assignment_id;
  if v_i.id is null then
    raise exception 'not_found';
  end if;
  v_q := v_i.content->'questions'->p_q_index;
  if v_q is null then
    raise exception 'not_found';
  end if;
  v_ok := public.hw_grade(v_q, left(p_response, 300));
  select academy_id into v_academy from public.homework_assignments where id = v_t.assignment_id;

  insert into public.homework_item_attempts (attempt_id, item_id) values (v_t.id, v_i.id) on conflict (attempt_id, item_id) do nothing;
  insert into public.homework_answers (attempt_id, item_id, q_index, skill, word, correct, response, ms)
  values (v_t.id, v_i.id, p_q_index, coalesce(v_q->>'skill', ''), coalesce(v_q->>'word', ''), v_ok, left(p_response, 200), greatest(0, least(p_ms, 3600000)))
  on conflict (attempt_id, item_id, q_index) do nothing;
  v_first := found;
  if not v_first then
    update public.homework_item_attempts set retry_count = retry_count + 1 where attempt_id = v_t.id and item_id = v_i.id;
  end if;

  insert into public.learning_events (academy_id, student_id, assignment_id, item_id, attempt_id, q_index, event_type, skill, word, content_id, difficulty, correct, response, ms, meta, client_id)
  values (v_academy, v_t.student_id, v_t.assignment_id, v_i.id, v_t.id, p_q_index,
          case when v_first then 'answer' else 'retry_answer' end,
          v_q->>'skill', v_q->>'word', v_q->>'contentId', coalesce((v_q->>'difficulty')::int, 1), v_ok, left(p_response, 200),
          greatest(0, least(p_ms, 3600000)), coalesce(v_q->'card', '{}'::jsonb) || jsonb_build_object('qtype', v_q->>'qtype', 'item_kind', v_i.kind), p_client_id)
  on conflict (client_id) do nothing;
  update public.homework_attempts set last_seen_at = now() where id = v_t.id;
  return jsonb_build_object('correct', v_ok, 'answer', public.hw_answer_text(v_q), 'first', v_first);
end $$;

-- ---------- 학생: 쉐도잉 한 줄 연습 · 활동 완료 ----------
create or replace function public.hw_progress(p_token uuid, p_item_id uuid, p_event text, p_meta jsonb, p_client_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_i public.homework_items;
  v_academy uuid;
  v_score int;
  v_total int;
  v_answered int;
begin
  if exists (select 1 from public.learning_events where client_id = p_client_id) then
    return jsonb_build_object('ok', true);
  end if;
  if p_event not in ('shadow_line', 'item_complete') then
    raise exception 'bad_event';
  end if;
  v_t := public.hw_attempt_for(p_token);
  select * into v_i from public.homework_items where id = p_item_id and assignment_id = v_t.assignment_id;
  if v_i.id is null then
    raise exception 'not_found';
  end if;
  select academy_id into v_academy from public.homework_assignments where id = v_t.assignment_id;
  insert into public.homework_item_attempts (attempt_id, item_id) values (v_t.id, v_i.id) on conflict (attempt_id, item_id) do nothing;

  if p_event = 'shadow_line' then
    update public.homework_item_attempts
       set meta = jsonb_build_object(
             'listens', coalesce((meta->>'listens')::int, 0) + greatest(0, least(coalesce((p_meta->>'listens')::int, 0), 50)),
             'repeats', coalesce((meta->>'repeats')::int, 0) + greatest(0, least(coalesce((p_meta->>'repeats')::int, 0), 50)),
             'lines', coalesce((meta->>'lines')::int, 0) + 1)
     where attempt_id = v_t.id and item_id = v_i.id;
  else
    v_total := jsonb_array_length(coalesce(v_i.content->'questions', '[]'::jsonb));
    select count(*), count(*) filter (where correct) into v_answered, v_score from public.homework_answers where attempt_id = v_t.id and item_id = v_i.id;
    if v_answered < v_total then
      raise exception 'incomplete';
    end if;
    update public.homework_item_attempts set finished_at = coalesce(finished_at, now()), score = v_score, total = v_total
     where attempt_id = v_t.id and item_id = v_i.id;
  end if;
  insert into public.learning_events (academy_id, student_id, assignment_id, item_id, attempt_id, event_type, meta, client_id)
  values (v_academy, v_t.student_id, v_t.assignment_id, v_i.id, v_t.id, p_event,
          jsonb_build_object('listens', p_meta->'listens', 'repeats', p_meta->'repeats', 'line', p_meta->'line', 'item_kind', v_i.kind), p_client_id)
  on conflict (client_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 학생: 숙제 끝 — 모든 활동이 끝났을 때만 ----------
create or replace function public.hw_finish(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_score int;
  v_total int;
begin
  v_t := public.hw_attempt_for(p_token, true);
  if exists (
    select 1 from public.homework_items i
     where i.assignment_id = v_t.assignment_id
       and not exists (select 1 from public.homework_item_attempts x where x.attempt_id = v_t.id and x.item_id = i.id and x.finished_at is not null)
  ) then
    raise exception 'incomplete';
  end if;
  select coalesce(sum(jsonb_array_length(coalesce(content->'questions', '[]'::jsonb))), 0) into v_total from public.homework_items where assignment_id = v_t.assignment_id;
  select count(*) into v_score from public.homework_answers where attempt_id = v_t.id and correct;
  if v_t.finished_at is null then
    update public.homework_attempts set finished_at = now(), score = v_score, total = v_total, last_seen_at = now() where id = v_t.id;
    insert into public.learning_events (academy_id, student_id, assignment_id, attempt_id, event_type, meta)
    select a.academy_id, v_t.student_id, v_t.assignment_id, v_t.id, 'assignment_complete', jsonb_build_object('score', v_score, 'total', v_total)
      from public.homework_assignments a where a.id = v_t.assignment_id;
  end if;
  return jsonb_build_object('score', v_score, 'total', v_total);
end $$;

-- ---------- 선생님: 숙제 만들기(대상 학생 + 활동) ----------
create or replace function public.hw_create_v2(
  p_class_id uuid,
  p_title text,
  p_items jsonb,
  p_student_ids uuid[] default null,
  p_due_at timestamptz default null,
  p_kind text default 'class',
  p_group_id uuid default null,
  p_recommendation jsonb default null
) returns public.homework_assignments
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_code text;
  v_row public.homework_assignments;
  v_item jsonb;
  v_pos int := 0;
  v_count int;
begin
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.academy_id = v_academy) then
    raise exception 'bad_class';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items';
  end if;
  if p_kind not in ('class', 'selected', 'custom') then
    raise exception 'bad_kind';
  end if;
  loop
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from public.homework_assignments where code = v_code and closed_at is null);
  end loop;
  insert into public.homework_assignments (academy_id, class_id, title, code, questions, settings, due_at, kind, group_id, recommendation)
  values (v_academy, p_class_id, coalesce(p_title, ''), v_code, '[]'::jsonb, '{}'::jsonb, p_due_at, p_kind, p_group_id, p_recommendation)
  returning * into v_row;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'kind', '') not in ('quiz', 'worksheet', 'game', 'shadowing') then
      raise exception 'bad_item';
    end if;
    insert into public.homework_items (assignment_id, position, kind, title, config, content)
    values (v_row.id, v_pos, v_item->>'kind', coalesce(v_item->>'title', ''), coalesce(v_item->'config', '{}'::jsonb), coalesce(v_item->'content', '{}'::jsonb));
    v_pos := v_pos + 1;
  end loop;

  insert into public.homework_assignment_targets (assignment_id, student_id, token_expires_at)
  select v_row.id, s.id, coalesce(p_due_at, now() + interval '30 days') + interval '7 days'
    from public.students s
   where s.class_id = p_class_id and s.academy_id = v_academy and s.archived_at is null
     and (p_student_ids is null or s.id = any(p_student_ids));
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no_students';
  end if;
  update public.homework_assignments set target_count = v_count where id = v_row.id returning * into v_row;
  return v_row;
end $$;

-- ---------- 선생님: 새 PIN(한 번만 보여 준다) ----------
create or replace function public.hw_reset_pin(p_student_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_pin text := lpad((floor(random() * 10000))::int::text, 4, '0');
begin
  if not exists (select 1 from public.students where id = p_student_id and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  insert into public.student_hw_pins (student_id, pin_hash) values (p_student_id, extensions.crypt(v_pin, extensions.gen_salt('bf', 8)))
  on conflict (student_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  update public.students set hw_pin = null where id = p_student_id and hw_pin is not null;
  return v_pin;
end $$;

-- ---------- 선생님: 반 학생의 PIN 있음/없음(원문·해시는 주지 않는다) ----------
create or replace function public.hw_pin_status(p_class_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('student_id', s.id, 'name', s.name, 'has_pin', p.student_id is not null, 'updated_at', p.updated_at) order by s.name)
      from public.students s left join public.student_hw_pins p on p.student_id = s.id
     where s.class_id = p_class_id and s.academy_id = v_academy and s.archived_at is null
  ), '[]'::jsonb);
end $$;

-- ---------- 선생님: 학생별 개인 링크 ----------
create or replace function public.hw_personal_links(p_assignment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.homework_assignments where id = p_assignment_id and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('student_id', s.id, 'name', s.name, 'access', g.access_token, 'has_pin', exists (select 1 from public.student_hw_pins p where p.student_id = s.id)) order by s.name)
      from public.homework_assignment_targets g join public.students s on s.id = g.student_id
     where g.assignment_id = p_assignment_id
  ), '[]'::jsonb);
end $$;

-- ---------- 선생님: 반의 숙제 목록(학생 수·완료·평균은 서버에서) ----------
create or replace function public.hw_class_overview(p_class_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc)
      from (
        select a.id, a.title, a.code, a.kind, a.group_id, a.due_at, a.closed_at, a.created_at,
               coalesce(a.target_count, 0) as target_count,
               (select count(*) from public.homework_attempts t where t.assignment_id = a.id and t.finished_at is not null) as done,
               (select count(*) from public.homework_attempts t where t.assignment_id = a.id and t.finished_at is null) as doing,
               (select round(avg(t.score::numeric / nullif(t.total, 0)) * 100) from public.homework_attempts t where t.assignment_id = a.id and t.finished_at is not null) as avg_pct,
               (select jsonb_agg(i.kind order by i.position) from public.homework_items i where i.assignment_id = a.id) as kinds,
               (select coalesce(sum(jsonb_array_length(coalesce(i.content->'questions', '[]'::jsonb))), 0) from public.homework_items i where i.assignment_id = a.id) as question_count,
               (select s.name from public.homework_assignment_targets g join public.students s on s.id = g.student_id where g.assignment_id = a.id and a.kind = 'custom' limit 1) as custom_student
          from public.homework_assignments a
         where a.class_id = p_class_id and a.academy_id = v_academy
         order by a.created_at desc
         limit 60
      ) x
  ), '[]'::jsonb);
end $$;

-- ---------- 선생님: 숙제 하나의 결과(분모 = 낸 당시 대상) ----------
create or replace function public.hw_assignment_summary(p_assignment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_a public.homework_assignments;
begin
  select * into v_a from public.homework_assignments where id = p_assignment_id and academy_id = v_academy;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'target_count', coalesce(v_a.target_count, 0),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'title', i.title, 'count', jsonb_array_length(coalesce(i.content->'questions', '[]'::jsonb))) order by i.position) from public.homework_items i where i.assignment_id = v_a.id), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id, 'name', s.name, 'archived', s.archived_at is not null,
        'status', case when t.id is null then 'none' when t.finished_at is not null then 'done' else 'doing' end,
        'answered', (select count(*) from public.homework_answers h where h.attempt_id = t.id),
        'correct', (select count(*) from public.homework_answers h where h.attempt_id = t.id and h.correct),
        'minutes', case when t.id is null then null else greatest(1, round(extract(epoch from (coalesce(t.finished_at, t.last_seen_at) - t.started_at)) / 60)) end,
        'retries', (select coalesce(sum(x.retry_count), 0) from public.homework_item_attempts x where x.attempt_id = t.id),
        'wrong_words', coalesce((select jsonb_agg(distinct h.word) from public.homework_answers h where h.attempt_id = t.id and not h.correct and h.word <> ''), '[]'::jsonb)
      ) order by s.name)
      from public.homework_assignment_targets g
      join public.students s on s.id = g.student_id
      left join public.homework_attempts t on t.assignment_id = v_a.id and t.student_id = s.id
      where g.assignment_id = v_a.id
    ), '[]'::jsonb),
    'class_wrong_words', coalesce((
      select jsonb_agg(jsonb_build_object('word', w.word, 'count', w.n, 'card', w.card) order by w.n desc)
        from (
          select h.word, count(*) as n,
                 (select e.meta from public.learning_events e where e.assignment_id = v_a.id and e.word = h.word and e.meta ? 'meaning' order by e.id desc limit 1) as card
            from public.homework_answers h join public.homework_attempts t on t.id = h.attempt_id
           where t.assignment_id = v_a.id and not h.correct and h.word <> ''
           group by h.word order by count(*) desc limit 15
        ) w
    ), '[]'::jsonb)
  );
end $$;

-- ---------- 선생님: 학생 학습 카드(통계는 서버에서) ----------
-- 가중치(최근을 조금 더): 7일 안 1.0, 30일 안 0.75, 그보다 오래 0.5. 처음 답(answer)만 센다 — 다시 풀기는 따로.
create or replace function public.student_learning_card(p_student_id uuid, p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_days int := case when p_days in (30, 90) then p_days else 30 end;
  v_from timestamptz := now() - make_interval(days => v_days);
  v_prev timestamptz := now() - make_interval(days => v_days * 2);
  v_s public.students;
begin
  select * into v_s from public.students where id = p_student_id and academy_id = v_academy;
  if v_s.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'student', jsonb_build_object('id', v_s.id, 'name', v_s.name, 'archived', v_s.archived_at is not null),
    'days', v_days,
    'graded', (select count(*) from public.learning_events where student_id = v_s.id and event_type = 'answer' and correct is not null and created_at >= v_from),
    'completed_activities', (select count(*) from public.homework_item_attempts x join public.homework_attempts t on t.id = x.attempt_id where t.student_id = v_s.id and x.finished_at >= v_from),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object('skill', c.skill, 'n', c.n, 'correct', c.k, 'weighted', c.w, 'prev_n', coalesce(p.n, 0), 'prev_correct', coalesce(p.k, 0)) order by c.skill)
        from (
          select skill, count(*) as n, count(*) filter (where correct) as k,
                 round((sum(case when correct then wt else 0 end) / nullif(sum(wt), 0))::numeric, 3) as w
            from (
              select skill, correct,
                     case when created_at > now() - interval '7 days' then 1.0 when created_at > now() - interval '30 days' then 0.75 else 0.5 end as wt
                from public.learning_events
               where student_id = v_s.id and event_type = 'answer' and correct is not null and skill is not null and created_at >= v_from
            ) z group by skill
        ) c
        left join (
          select skill, count(*) as n, count(*) filter (where correct) as k
            from public.learning_events
           where student_id = v_s.id and event_type = 'answer' and correct is not null and created_at >= v_prev and created_at < v_from
           group by skill
        ) p on p.skill = c.skill
    ), '[]'::jsonb),
    'habit', jsonb_build_object(
      'assigned', (select count(*) from public.homework_assignment_targets g join public.homework_assignments a on a.id = g.assignment_id where g.student_id = v_s.id and a.created_at >= v_from),
      'finished', (select count(*) from public.homework_attempts t join public.homework_assignments a on a.id = t.assignment_id where t.student_id = v_s.id and a.created_at >= v_from and t.finished_at is not null),
      'prev_assigned', (select count(*) from public.homework_assignment_targets g join public.homework_assignments a on a.id = g.assignment_id where g.student_id = v_s.id and a.created_at >= v_prev and a.created_at < v_from),
      'prev_finished', (select count(*) from public.homework_attempts t join public.homework_assignments a on a.id = t.assignment_id where t.student_id = v_s.id and a.created_at >= v_prev and a.created_at < v_from and t.finished_at is not null)
    ),
    'retries', jsonb_build_object(
      'count', (select count(*) from public.learning_events where student_id = v_s.id and event_type = 'retry_answer' and created_at >= v_from),
      'corrected', (select count(*) from public.learning_events where student_id = v_s.id and event_type = 'retry_answer' and correct and created_at >= v_from)
    ),
    'shadowing', jsonb_build_object(
      'lines', (select count(*) from public.learning_events where student_id = v_s.id and event_type = 'shadow_line' and created_at >= v_from),
      'listens', (select coalesce(sum((meta->>'listens')::int), 0) from public.learning_events where student_id = v_s.id and event_type = 'shadow_line' and created_at >= v_from)
    ),
    'wrong_words', coalesce((
      select jsonb_agg(jsonb_build_object('word', w.word, 'count', w.n, 'skills', w.skills) order by w.n desc)
        from (
          select word, count(*) as n, jsonb_agg(distinct skill) as skills
            from public.learning_events
           where student_id = v_s.id and event_type = 'answer' and correct = false and coalesce(word, '') <> '' and created_at >= v_from
           group by word order by count(*) desc limit 12
        ) w
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'created_at', a.created_at, 'kind', a.kind,
               'status', case when t.id is null then 'none' when t.finished_at is not null then 'done' else 'doing' end,
               'score', t.score, 'total', t.total) order by a.created_at desc)
        from (select * from public.homework_assignment_targets where student_id = v_s.id) g
        join public.homework_assignments a on a.id = g.assignment_id
        left join public.homework_attempts t on t.assignment_id = a.id and t.student_id = v_s.id
       where a.created_at >= now() - interval '90 days'
    ), '[]'::jsonb),
    -- 통장 "숙제 완료/미제출" 버튼 기록(온라인 숙제와 따로 보여 준다, 합치지 않는다)
    'passbook_homework', jsonb_build_object(
      'done', (select count(*) from public.transactions where student_id = v_s.id and is_homework and delta > 0 and created_at >= v_from),
      'missing', (select count(*) from public.transactions where student_id = v_s.id and is_homework and delta < 0 and created_at >= v_from)
    )
  );
end $$;

-- ---------- 선생님: 추천 숙제 재료(낱말별 최근 기록) ----------
create or replace function public.student_review_candidates(p_student_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.students where id = p_student_id and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'graded', (select count(*) from public.learning_events where student_id = p_student_id and event_type = 'answer' and correct is not null and created_at > now() - interval '90 days'),
    'completed_activities', (select count(*) from public.homework_item_attempts x join public.homework_attempts t on t.id = x.attempt_id where t.student_id = p_student_id and x.finished_at > now() - interval '90 days'),
    'words', coalesce((
      select jsonb_agg(w order by (w->>'last_seen') desc)
        from (
          select jsonb_build_object(
                   'word', e.word,
                   'card', (select x.meta from public.learning_events x where x.student_id = p_student_id and x.word = e.word and x.meta ? 'meaning' order by x.id desc limit 1),
                   'last_seen', max(e.created_at),
                   'skills', jsonb_object_agg(e.skill, jsonb_build_object(
                     'wrong', e.wrong, 'right', e.right_n, 'last_wrong', e.last_wrong, 'last_right', e.last_right))
                 ) as w
            from (
              select word, skill,
                     count(*) filter (where correct = false) as wrong,
                     count(*) filter (where correct) as right_n,
                     max(created_at) filter (where correct = false) as last_wrong,
                     max(created_at) filter (where correct) as last_right,
                     max(created_at) as created_at
                from public.learning_events
               where student_id = p_student_id and event_type in ('answer', 'retry_answer') and correct is not null
                 and coalesce(word, '') <> '' and skill is not null and created_at > now() - interval '90 days'
               group by word, skill
            ) e
           group by e.word
        ) s
    ), '[]'::jsonb)
  );
end $$;

-- ---------- 다음 단계 학생 좌석 요금의 사용량 경계(계산만 — 결제·제한·청구 없음) ----------
-- 기간 안에 온라인 숙제를 실제로 시작한 고유 학생(보관 학생 제외). 같은 학생이 여러 숙제를 해도 한 명.
create or replace function public.academy_homework_usage(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  return coalesce((
    select jsonb_build_object(
             'active_students', count(*),
             'students', jsonb_agg(jsonb_build_object('student_id', u.student_id, 'first_active', u.first_at, 'last_active', u.last_at)))
      from (
        select t.student_id, min(t.started_at) as first_at, max(t.last_seen_at) as last_at
          from public.homework_attempts t
          join public.homework_assignments a on a.id = t.assignment_id
          join public.students s on s.id = t.student_id
         where a.academy_id = v_academy and s.archived_at is null
           and t.started_at < p_to and t.last_seen_at >= p_from
         group by t.student_id
      ) u
  ), jsonb_build_object('active_students', 0, 'students', '[]'::jsonb));
end $$;

-- ---------- 권한: 기본 PUBLIC 실행을 거두고 필요한 역할에만 ----------
-- 예전 함수: 명단을 주던 로그인·클라이언트 채점은 없앤다
drop function if exists public.hw_login(text, uuid, text);
drop function if exists public.hw_answer(uuid, int, boolean, text, text, text, int);

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.hw_open(text)', 'public.hw_login_name(text, text, text)', 'public.hw_open_personal(text)', 'public.hw_state(uuid)',
    'public.hw_submit(uuid, uuid, int, text, uuid, int)', 'public.hw_progress(uuid, uuid, text, jsonb, uuid)', 'public.hw_finish(uuid)',
    'public.hw_create(uuid, text, jsonb, uuid, jsonb, timestamptz)',
    'public.hw_create_v2(uuid, text, jsonb, uuid[], timestamptz, text, uuid, jsonb)', 'public.hw_reset_pin(uuid)', 'public.hw_pin_status(uuid)', 'public.hw_personal_links(uuid)',
    'public.hw_class_overview(uuid)', 'public.hw_assignment_summary(uuid)', 'public.student_learning_card(uuid, int)',
    'public.student_review_candidates(uuid)', 'public.academy_homework_usage(timestamptz, timestamptz)',
    'public.hw_attempt_for(uuid, boolean)', 'public.hw_staff_academy()', 'public.students_archive_instead_of_delete()',
    'public.hw_norm(text)', 'public.hw_grade(jsonb, text)', 'public.hw_answer_text(jsonb)', 'public.hw_public_item(public.homework_items)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.hw_open(text) to anon, authenticated;
grant execute on function public.hw_login_name(text, text, text) to anon, authenticated;
grant execute on function public.hw_open_personal(text) to anon, authenticated;
grant execute on function public.hw_state(uuid) to anon, authenticated;
grant execute on function public.hw_submit(uuid, uuid, int, text, uuid, int) to anon, authenticated;
grant execute on function public.hw_progress(uuid, uuid, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.hw_finish(uuid) to anon, authenticated;
grant execute on function public.hw_create(uuid, text, jsonb, uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.hw_create_v2(uuid, text, jsonb, uuid[], timestamptz, text, uuid, jsonb) to authenticated;
grant execute on function public.hw_reset_pin(uuid) to authenticated;
grant execute on function public.hw_pin_status(uuid) to authenticated;
grant execute on function public.hw_personal_links(uuid) to authenticated;
grant execute on function public.hw_class_overview(uuid) to authenticated;
grant execute on function public.hw_assignment_summary(uuid) to authenticated;
grant execute on function public.student_learning_card(uuid, int) to authenticated;
grant execute on function public.student_review_candidates(uuid) to authenticated;
grant execute on function public.academy_homework_usage(timestamptz, timestamptz) to authenticated;
