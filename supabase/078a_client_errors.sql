-- 078a: 화면 오류 수집 표(2026-10-16, 관리자 자동화 1단계)
-- 화면에서 난 오류를 앱이 보내 오면 쌓는다. 직접 읽기·쓰기는 막고(정책 없음) 함수로만 다룬다.
-- 순서: 078a → 078b → 078c → 078d → 078e → 078_check.sql (하나씩 실행)

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  message text not null,
  stack text,
  page text,
  user_agent text,
  academy_id uuid,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_fp_idx on public.client_errors (fingerprint, created_at desc);

alter table public.client_errors enable row level security;
