-- ============================================================
--  031: 공지·알림함 + 고객센터(문의) + 관리자 도구 — 2026-09-27
--
--  1) announcements / announcement_reads : 관리자가 보내는 공지(전체·유료·무료·특정 학원),
--     알림함·첫 화면 팝업·상단 띠로 보인다. 누가 읽었는지 남긴다.
--  2) support_tickets / support_messages : 선생님 문의(유형·내용·캡처·보던 페이지) ↔ 관리자 답변.
--     답변이 오면 선생님 알림함에, 새 문의는 관리자 "오늘 할 일"에.
--     캡처는 비공개 저장소(support-attachments) — 본인과 관리자만 본다(학생 이름이 찍혀 있을 수 있어서).
--  3) 관리자 전용: academy_admin_notes(학원 메모 — 학원 사람은 못 봄), admin_actions(조치 기록),
--     admin_today / admin_academy_rows / admin_academy_detail / admin_tickets 함수.
--
--  SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.
-- ============================================================

-- ---------- 1) 공지 ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  -- info: 일반 / important: 중요(첫 화면 팝업 권장) / maintenance: 점검(상단 띠 권장)
  level text not null default 'info' check (level in ('info', 'important', 'maintenance')),
  audience text not null default 'all' check (audience in ('all', 'paid', 'free', 'academy')),
  academy_id uuid references public.academies(id) on delete cascade,
  popup boolean not null default false,
  banner boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists announcements_active_idx on public.announcements (starts_at desc);

alter table public.announcements enable row level security;
drop policy if exists announcements_admin on public.announcements;
create policy announcements_admin on public.announcements
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements
  for select using (
    starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (
      audience = 'all'
      or (audience = 'academy' and academy_id = public.my_academy_id())
      or (audience in ('paid', 'free') and exists (
        select 1 from public.academies a where a.id = public.my_academy_id() and a.plan = audience))
    )
  );

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
alter table public.announcement_reads enable row level security;
drop policy if exists announcement_reads_own on public.announcement_reads;
create policy announcement_reads_own on public.announcement_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists announcement_reads_admin on public.announcement_reads;
create policy announcement_reads_admin on public.announcement_reads
  for select using (public.is_platform_admin());

-- ---------- 2) 문의 ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid default public.my_academy_id() references public.academies(id) on delete set null,
  user_id uuid not null default auth.uid(),
  category text not null default 'howto' check (category in ('howto', 'bug', 'billing', 'idea', 'other')),
  subject text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  -- 오류를 다시 확인하기 쉽게: 문의할 때 보던 페이지·브라우저
  page_url text,
  user_agent text,
  user_unread boolean not null default false,
  admin_unread boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, updated_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, updated_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')),
  author_id uuid default auth.uid(),
  body text not null,
  attachment_path text,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_tickets_own on public.support_tickets;
create policy support_tickets_own on public.support_tickets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists support_tickets_admin on public.support_tickets;
create policy support_tickets_admin on public.support_tickets
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists support_messages_own_read on public.support_messages;
create policy support_messages_own_read on public.support_messages
  for select using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
drop policy if exists support_messages_own_insert on public.support_messages;
create policy support_messages_own_insert on public.support_messages
  for insert with check (
    sender = 'user'
    and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );
drop policy if exists support_messages_admin on public.support_messages;
create policy support_messages_admin on public.support_messages
  for all using (public.is_platform_admin()) with check (public.is_platform_admin() and sender = 'admin');

-- 새 메시지가 오면 문의 상태·읽음 표시를 맞춘다
create or replace function public.support_message_touch()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.support_tickets
     set status = case when new.sender = 'admin' then 'answered' else 'open' end,
         user_unread = (new.sender = 'admin'),
         admin_unread = (new.sender = 'user'),
         updated_at = now()
   where id = new.ticket_id;
  return new;
end $$;
drop trigger if exists support_message_touch on public.support_messages;
create trigger support_message_touch after insert on public.support_messages
  for each row execute function public.support_message_touch();

-- 캡처 첨부(비공개): <user_id>/<파일> — 본인과 관리자만
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;
drop policy if exists support_attachments_insert on storage.objects;
create policy support_attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists support_attachments_select on storage.objects;
create policy support_attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_platform_admin()));

-- ---------- 3) 관리자 도구 ----------
create table if not exists public.academy_admin_notes (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.academy_admin_notes enable row level security;
drop policy if exists academy_admin_notes_admin on public.academy_admin_notes;
create policy academy_admin_notes_admin on public.academy_admin_notes
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid default auth.uid(),
  academy_id uuid references public.academies(id) on delete set null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
drop policy if exists admin_actions_admin on public.admin_actions;
create policy admin_actions_admin on public.admin_actions
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 오늘 할 일(첫 화면 숫자)
create or replace function public.admin_today()
returns json
language sql stable security definer set search_path = public
as $$
  select case when not public.is_platform_admin() then null else json_build_object(
    'new_tickets', (select count(*) from public.support_tickets where admin_unread and status <> 'closed'),
    'open_tickets', (select count(*) from public.support_tickets where status = 'open'),
    'billing_failures', (select count(*) from public.academies where billing_failure_count > 0),
    'expiring_soon', (select count(*) from public.academies where plan = 'paid' and plan_expires_at is not null and plan_expires_at <= current_date + 7),
    'pending_cancel', (select count(*) from public.academies where plan_status = 'pending_cancel'),
    'signups_today', (select count(*) from public.academies where created_at >= date_trunc('day', now())),
    'signups_7d', (select count(*) from public.academies where created_at >= now() - interval '7 days'),
    'academies', (select count(*) from public.academies),
    'paid', (select count(*) from public.academies where plan = 'paid'),
    'active_7d', (select count(distinct p.academy_id) from public.profiles p join auth.users u on u.id = p.id
                   where p.academy_id is not null and u.last_sign_in_at >= now() - interval '7 days')
  ) end
$$;

-- 학원 목록(필터용 정보 포함)
create or replace function public.admin_academy_rows()
returns table (
  academy_id uuid,
  name text,
  created_at timestamptz,
  plan text,
  plan_status text,
  plan_expires_at date,
  next_billing_at date,
  billing_failure_count int,
  owner_email text,
  owner_name text,
  teacher_count int,
  student_count int,
  lesson_count int,
  last_active_at timestamptz,
  open_tickets int
)
language sql stable security definer set search_path = public
as $$
  select
    a.id, a.name, a.created_at, a.plan, a.plan_status, a.plan_expires_at, a.next_billing_at, a.billing_failure_count,
    (select u.email from public.profiles p join auth.users u on u.id = p.id where p.academy_id = a.id and p.role = 'owner' order by p.created_at limit 1)::text,
    (select p.display_name from public.profiles p where p.academy_id = a.id and p.role = 'owner' order by p.created_at limit 1),
    (select count(*) from public.profiles p where p.academy_id = a.id and p.role in ('owner', 'teacher'))::int,
    (select count(*) from public.students s where s.academy_id = a.id)::int,
    (select count(*) from public.curriculum_lessons l where l.academy_id = a.id)::int,
    (select max(u.last_sign_in_at) from public.profiles p join auth.users u on u.id = p.id where p.academy_id = a.id),
    (select count(*) from public.support_tickets t where t.academy_id = a.id and t.status = 'open')::int
  from public.academies a
  where public.is_platform_admin()
  order by a.created_at desc;
$$;

-- 학원 상세(사람·사용량·결제·메모·문의·조치 기록)
create or replace function public.admin_academy_detail(p_academy_id uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select case when not public.is_platform_admin() then null else json_build_object(
    'academy', (select to_json(a) from (
        select id, name, created_at, plan, plan_status, plan_started_at, plan_expires_at, next_billing_at,
               billing_failure_count, card_brand, card_last4, invite_code, point_unit
          from public.academies where id = p_academy_id) a),
    'members', (select coalesce(json_agg(m order by m.role, m.created_at), '[]'::json) from (
        select p.id, p.display_name, p.role, p.created_at, u.email, u.last_sign_in_at
          from public.profiles p join auth.users u on u.id = p.id
         where p.academy_id = p_academy_id and p.role in ('owner', 'teacher')) m),
    'usage', json_build_object(
        'classes', (select count(*) from public.classes where academy_id = p_academy_id),
        'students', (select count(*) from public.students where academy_id = p_academy_id),
        'lessons', (select count(*) from public.curriculum_lessons where academy_id = p_academy_id),
        'lessons_30d', (select count(*) from public.curriculum_lessons where academy_id = p_academy_id and updated_at >= now() - interval '30 days'),
        'word_lists', (select count(*) from public.word_lists where academy_id = p_academy_id),
        'game_templates', (select count(*) from public.game_templates where academy_id = p_academy_id),
        'quizshows_30d', (select count(*) from public.live_sessions where academy_id = p_academy_id and created_at >= now() - interval '30 days'),
        'transactions_30d', (select count(*) from public.transactions where academy_id = p_academy_id and created_at >= now() - interval '30 days')
    ),
    'note', (select note from public.academy_admin_notes where academy_id = p_academy_id),
    'tickets', (select coalesce(json_agg(t order by t.updated_at desc), '[]'::json) from (
        select id, subject, category, status, updated_at from public.support_tickets where academy_id = p_academy_id limit 20) t),
    'actions', (select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
        select action, detail, created_at from public.admin_actions where academy_id = p_academy_id order by created_at desc limit 20) x)
  ) end
$$;

-- 문의함 목록(학원 이름·보낸 사람과 함께)
create or replace function public.admin_tickets(p_status text default null)
returns table (
  id uuid,
  academy_id uuid,
  academy_name text,
  user_email text,
  user_name text,
  category text,
  subject text,
  status text,
  admin_unread boolean,
  page_url text,
  user_agent text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select t.id, t.academy_id, a.name, u.email::text, p.display_name, t.category, t.subject, t.status, t.admin_unread,
         t.page_url, t.user_agent, t.created_at, t.updated_at
    from public.support_tickets t
    left join public.academies a on a.id = t.academy_id
    left join auth.users u on u.id = t.user_id
    left join public.profiles p on p.id = t.user_id
   where public.is_platform_admin() and (p_status is null or t.status = p_status)
   order by t.admin_unread desc, t.updated_at desc
   limit 300;
$$;

grant execute on function public.admin_today() to authenticated;
grant execute on function public.admin_academy_rows() to authenticated;
grant execute on function public.admin_academy_detail(uuid) to authenticated;
grant execute on function public.admin_tickets(text) to authenticated;
