-- ============================================================
--  039: 영상 쉐도잉 라이브러리 — 2026-10-03
--
--  클래스뱅크가 미리 만들어 둔 "영상 장면"(유튜브 공식 채널 영상의 2~4분 구간 + AI 대사표).
--  선생님은 수업 만들기의 쉐도잉 슬라이드에서 골라 쓴다. 영상 파일은 갖고 있지 않고
--  유튜브 플레이어로 원래 영상을 그 구간만 튼다.
--
--  저작권자가 내려 달라고 하면 관리자 화면에서 "내리기"(hidden = true) — 그 순간부터
--  라이브러리에서 사라지고, 이미 수업에 넣은 슬라이드도 "내려간 영상"으로 막힌다.
--  디즈니(픽사·마블·스타워즈·내셔널지오그래픽·20세기 스튜디오 포함) 영상은 넣지 않는다.
--
--  SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.video_clips (
  id uuid primary key default gen_random_uuid(),
  -- 묶음(시리즈) 이름: "Peppa Pig", "Caillou" …
  series text not null,
  title text not null,
  -- 한국어 한 줄 소개(선택)
  summary text not null default '',
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  channel text not null default '',
  start_sec numeric not null default 0,
  end_sec numeric not null,
  -- 1~4 초등 Language Level, 5 중등 이상
  level int not null default 2 check (level between 1 and 6),
  tags text[] not null default '{}',
  -- 대사표: 한 줄에 "[m:ss.s-m:ss.s] 배역: 영어 | 해석" (app/src/lib/shadowLines.ts)
  script text not null,
  -- 장면에 나온 핵심 낱말(영어)
  words text[] not null default '{}',
  -- 수업 묶음(app/src/lib/videoClips.ts 의 ClipPack): 내용 질문, 단어(영화 예문·나오는 시간),
  -- 문법 포인트(문법 메뉴 id) + 바꿔 말하기 단서, 리스닝 빙고 낱말
  pack jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  hidden boolean not null default false,
  hidden_reason text,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  unique (youtube_id, start_sec)
);
alter table public.video_clips add column if not exists pack jsonb not null default '{}'::jsonb;
create index if not exists video_clips_series_idx on public.video_clips (series, sort_order);

alter table public.video_clips enable row level security;

-- 내려가지 않은 장면은 누구나 읽는다(학생 따라보기 화면은 로그인 없이 대사를 받는다).
drop policy if exists video_clips_read on public.video_clips;
create policy video_clips_read on public.video_clips
  for select using (not hidden or public.is_platform_admin());

drop policy if exists video_clips_admin on public.video_clips;
create policy video_clips_admin on public.video_clips
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select on public.video_clips to anon, authenticated;
grant insert, update, delete on public.video_clips to authenticated;
