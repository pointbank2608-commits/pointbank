-- ============================================================
--  마이그레이션 005 — 출석부 (등원/하원 체크)
--
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

create table if not exists public.attendance (
  id             uuid primary key default gen_random_uuid(),
  academy_id     uuid not null references public.academies(id) on delete cascade,
  class_id       uuid not null references public.classes(id)   on delete cascade,
  student_id     uuid not null references public.students(id)  on delete cascade,
  attended_on    date not null,
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  checked_in_by  uuid references auth.users(id) on delete set null,
  checked_out_by uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (student_id, attended_on)
);
create index if not exists attendance_class_month_idx on public.attendance(class_id, attended_on);
create index if not exists attendance_student_idx on public.attendance(student_id, attended_on desc);

alter table public.attendance enable row level security;

-- 선생님/원장: 학원 전체. 학생: 본인 것만 (추후 학생용 화면에 쓸 수 있도록 미리 열어둠).
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select using (
    academy_id = public.my_academy_id()
    and (public.is_staff() or student_id = public.my_student_id())
  );

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());
