-- 093a: 영상 숙제 시청 기록 + 광고 표시. 새 표만 추가한다(기존 숙제 표는 건드리지 않음).
-- 시청 한 번(view) = 학생이 영상을 처음부터 끝까지 본 한 번. 본 시간(watched_sec)은 서버가 시계로 한 번 더 제한한다.

create table if not exists public.homework_watch_views (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.homework_attempts(id) on delete cascade,
  item_id uuid not null references public.homework_items(id) on delete cascade,
  view_key uuid not null,
  duration_sec int not null default 0,
  watched_sec int not null default 0,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (attempt_id, item_id, view_key)
);
create index if not exists homework_watch_views_item_idx on public.homework_watch_views (item_id, attempt_id);
alter table public.homework_watch_views enable row level security;

-- 선생님이 "이 영상은 광고가 나와요"를 표시해 두는 표(학원 단위)
create table if not exists public.video_ad_flags (
  academy_id uuid not null references public.academies(id) on delete cascade,
  video_id text not null,
  has_ads boolean not null default true,
  note text not null default '',
  flagged_at timestamptz not null default now(),
  primary key (academy_id, video_id)
);
alter table public.video_ad_flags enable row level security;

drop policy if exists video_ad_flags_all on public.video_ad_flags;
create policy video_ad_flags_all on public.video_ad_flags
  for all using (academy_id = public.my_academy_id() and public.is_staff())
  with check (academy_id = public.my_academy_id() and public.is_staff());
