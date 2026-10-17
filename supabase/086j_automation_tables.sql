-- 086j: 자동 작업 목록·실행 기록·안내 메시지 표(2026-10-18).
-- 안내 메시지 작업(lifecycle)은 전부 꺼진 채(enabled=false, 모의 실행)로 시작한다. 켜기 전에는 아무것도 보내지 않는다.
-- 외부에서 도는 작업(결제 배치·점검 띠·주간 리포트)은 자기 실행을 automation_record_run 으로 알려야 "마지막 성공"이 보인다.
-- 알리지 않은 작업은 "실행 기록 없음"으로 보인다(스케줄러가 연결되지 않았을 수 있다는 뜻 — 정상 작동으로 표시하지 않는다).

create table if not exists public.automation_jobs (
  job_key text primary key,
  title text not null,
  description text,
  kind text not null check (kind in ('lifecycle', 'billing', 'maintenance', 'report')),
  -- managed: internal = 이 화면에서 켜고 끄는 작업 / external = Supabase 스케줄러·Edge Function 이 따로 돌리는 작업(앱은 실행 기록만 본다)
  managed text not null default 'internal' check (managed in ('internal', 'external')),
  enabled boolean not null default false,
  mode text not null default 'dry_run' check (mode in ('dry_run', 'live')),
  channel text not null default 'none' check (channel in ('none', 'email', 'in_app')),
  schedule text,
  expected_interval_minutes int,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_success_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null references public.automation_jobs(job_key) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failed', 'dry_run')),
  targets int not null default 0,
  done int not null default 0,
  failed int not null default 0,
  dry_run boolean not null default false,
  error text,
  detail jsonb
);
create index if not exists automation_runs_job_idx on public.automation_runs (job_key, started_at desc);

create table if not exists public.lifecycle_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  academy_id uuid references public.academies(id) on delete cascade,
  dedupe_key text not null,
  status text not null default 'planned' check (status in ('planned', 'sending', 'sent', 'failed', 'cancelled')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  claimed_at timestamptz,
  run_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (kind, dedupe_key)
);
create index if not exists lifecycle_messages_due_idx on public.lifecycle_messages (kind, status, next_attempt_at);

alter table public.automation_jobs enable row level security;
alter table public.automation_runs enable row level security;
alter table public.lifecycle_messages enable row level security;
drop policy if exists automation_jobs_admin on public.automation_jobs;
create policy automation_jobs_admin on public.automation_jobs for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists automation_runs_admin on public.automation_runs;
create policy automation_runs_admin on public.automation_runs for select using (public.is_platform_admin());
drop policy if exists lifecycle_messages_admin on public.lifecycle_messages;
create policy lifecycle_messages_admin on public.lifecycle_messages for select using (public.is_platform_admin());
