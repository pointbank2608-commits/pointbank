-- 090a 단어암기숙제(wm) 표 4개 — 계획(배정 시점 단어 스냅샷)·대상 학생·학생별 단어 상태·하루 학습(session)·답 기록.
-- 비파괴: 기존 숙제 표는 건드리지 않는다. 적용 순서: 090a → 090b → … → 090m → 090_check.sql

create table if not exists public.wm_plans (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  -- 같은 배정 요청을 두 번 보내도 한 번만 만든다(중복 클릭·재시도)
  request_id uuid not null,
  title text not null default '',
  -- 어디서 가져왔는지(단어장 이름 등) — 원본을 고쳐도 아래 cards 는 그대로
  source jsonb not null default '{}'::jsonb,
  -- 배정 시점 단어 스냅샷: [{key, word, meaning, pos, imageUrl, example}]
  cards jsonb not null,
  cards_hash text not null,
  daily_mode text not null check (daily_mode in ('light', 'normal')),
  study_days int not null default 14 check (study_days between 3 and 60),
  review_days int not null default 14 check (review_days between 0 and 60),
  start_date date not null,
  rule_version text not null default 'wm-v1',
  created_by uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (academy_id, request_id)
);
create index if not exists wm_plans_class_idx on public.wm_plans (class_id, created_at desc);

create table if not exists public.wm_targets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.wm_plans(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  -- 학생별 개인 링크(/wm/토큰). 이름·학생 id 를 담지 않는 긴 임의 값
  access_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  unique (plan_id, student_id)
);
create index if not exists wm_targets_student_idx on public.wm_targets (student_id);

create table if not exists public.wm_words (
  target_id uuid not null references public.wm_targets(id) on delete cascade,
  key text not null,
  -- 0 처음 만남 · 1 연습 중 · 2 혼자 맞힘(다음 날 이후 도움 없이 처음 답으로) · 3 며칠 뒤에도 기억함
  stage int not null default 0 check (stage between 0 and 3),
  introduced_day date,
  tries int not null default 0,
  ok_total int not null default 0,
  unaided_ok int not null default 0,
  unaided_days date[] not null default '{}',
  first_ok_day date,
  last_ok_day date,
  streak int not null default 0,
  miss int not null default 0,
  miss_days int not null default 0,
  last_miss_day date,
  skill_miss jsonb not null default '{}'::jsonb,
  last_skill text,
  last_style text,
  relearning boolean not null default false,
  carried boolean not null default false,
  due_day date,
  last_seen_day date,
  updated_at timestamptz not null default now(),
  primary key (target_id, key)
);

create table if not exists public.wm_sessions (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.wm_targets(id) on delete cascade,
  day date not null,
  -- 정답을 포함한 문제 목록(학생에게는 정답·낱말 키를 뺀 것만 간다)
  questions jsonb not null default '[]'::jsonb,
  ord jsonb not null default '[]'::jsonb,
  main_budget int not null,
  retry_left int not null,
  counts jsonb not null default '{}'::jsonb,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (target_id, day)
);

create table if not exists public.wm_answers (
  id bigserial primary key,
  session_id uuid not null references public.wm_sessions(id) on delete cascade,
  q_index int not null,
  key text not null,
  style text,
  skill text,
  kind text not null check (kind in ('answer', 'retry', 'ack')),
  correct boolean,
  helped boolean not null default false,
  unaided boolean not null default false,
  response text,
  client_id uuid not null unique,
  created_at timestamptz not null default now(),
  unique (session_id, q_index)
);

alter table public.wm_plans enable row level security;
alter table public.wm_targets enable row level security;
alter table public.wm_words enable row level security;
alter table public.wm_sessions enable row level security;
alter table public.wm_answers enable row level security;
