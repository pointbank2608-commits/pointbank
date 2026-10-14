-- 077: 선생님 폰 리모컨(1단계) — 칠판 화면과 폰이 같은 선생님 계정으로 주고받는 연결 한 줄
-- 이 한 파일만 실행하면 된다(Supabase SQL Editor).

create table if not exists public.remote_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  cmd jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.remote_sessions enable row level security;

drop policy if exists remote_sessions_own on public.remote_sessions;
create policy remote_sessions_own on public.remote_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.remote_sessions to authenticated;

-- 실시간으로 바로 받기(없으면 앱이 2.5초마다 확인한다)
do $$
begin
  alter publication supabase_realtime add table public.remote_sessions;
exception when duplicate_object then null;
         when undefined_object then null;
end $$;
