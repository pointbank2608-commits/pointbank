-- 079a: 승인함·FAQ 승격·내 수업 첨부(2026-10-16, 관리자 자동화 2단계)
-- 순서: 079a → 079b → 079c → 079d → 079_check.sql (하나씩 실행)

-- 1) 문의에 "이 수업을 같이 보냄" 표시(선생님이 직접 체크한 경우만 채워짐 = 열람 동의)
alter table public.support_tickets
  add column if not exists attached_lesson_id uuid references public.curriculum_lessons(id) on delete set null;

-- 2) 관리자가 문의에서 올린 FAQ(앱에 들어 있는 기본 FAQ 뒤에 합쳐 보인다)
create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'start',
  q_ko text not null,
  a_ko text not null,
  q_en text,
  a_en text,
  link text,
  published boolean not null default true,
  source_ticket uuid references public.support_tickets(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.faq_entries enable row level security;

drop policy if exists faq_entries_read on public.faq_entries;
create policy faq_entries_read on public.faq_entries
  for select to authenticated using (published);

drop policy if exists faq_entries_admin on public.faq_entries;
create policy faq_entries_admin on public.faq_entries
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
