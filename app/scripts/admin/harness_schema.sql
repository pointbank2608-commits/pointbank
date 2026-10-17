-- 로컬 테스트용 최소 스키마(실제 Supabase 와 같은 열 이름만 흉내 낸다). 운영 DB 와 무관하다.
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('test.role', true), ''), 'authenticated') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  point_unit text not null default '포인트',
  invite_code text not null default substr(md5(random()::text), 1, 6),
  created_at timestamptz not null default now(),
  plan text not null default 'free' check (plan in ('free', 'paid')),
  plan_status text not null default 'active' check (plan_status in ('active', 'pending_cancel')),
  plan_started_at timestamptz, card_brand text, card_last4 text, card_registered_at timestamptz,
  next_billing_at date, billing_cycle_day int, billing_failure_count int not null default 0, plan_expires_at date,
  trial_ends_at date not null default ((now() at time zone 'Asia/Seoul')::date + 14),
  features jsonb
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  academy_id uuid references public.academies(id) on delete cascade,
  role text not null check (role in ('owner', 'teacher', 'student', 'admin')),
  display_name text not null, created_at timestamptz not null default now()
);
create index profiles_academy_idx on public.profiles(academy_id);
create table public.classes (id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade, name text not null, created_at timestamptz default now());
create table public.students (id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade, class_id uuid, name text not null, created_at timestamptz default now());
create index students_academy_idx on public.students(academy_id);
create table public.curriculum_lessons (id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade, name text, updated_at timestamptz default now(), created_at timestamptz default now());
create table public.admin_actions (id uuid primary key default gen_random_uuid(), admin_id uuid default auth.uid(), academy_id uuid references public.academies(id) on delete set null, action text not null, detail jsonb, created_at timestamptz not null default now());
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references public.academies(id) on delete set null,
  user_id uuid not null default auth.uid(),
  category text not null default 'howto', subject text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  page_url text, user_agent text, user_unread boolean not null default false, admin_unread boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  attached_lesson_id uuid
);
create table public.support_messages (id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')), author_id uuid default auth.uid(), body text not null, attachment_path text, created_at timestamptz not null default now());
create table public.client_errors (id uuid primary key default gen_random_uuid(), fingerprint text not null, message text not null, stack text, page text, user_agent text,
  academy_id uuid, user_id uuid, created_at timestamptz not null default now());
create table public.billing_history (id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
  billed_at timestamptz not null default now(), period_start date not null, period_end date not null, student_count int not null default 0, amount_krw int not null,
  status text not null check (status in ('success', 'failed')), portone_payment_id text, failure_reason text, created_at timestamptz not null default now());
create table public.announcements (id uuid primary key default gen_random_uuid(), title text not null, body text not null default '', level text not null default 'info',
  audience text not null default 'all', academy_id uuid, popup boolean not null default false, banner boolean not null default false,
  starts_at timestamptz not null default now(), ends_at timestamptz, created_at timestamptz not null default now(), auto_key text);

create function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;
create function public.my_academy_id() returns uuid language sql stable security definer set search_path = public
as $$ select academy_id from public.profiles where id = auth.uid() $$;
create function public.protect_billing_columns() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.support_message_touch() returns trigger language plpgsql as $$ begin return new; end $$;
create trigger support_message_touch after insert on public.support_messages for each row execute function public.support_message_touch();

create table public.academy_deletion_requests (academy_id uuid primary key references public.academies(id) on delete cascade, requested_at timestamptz not null default now(), requested_by uuid);
create function public.academy_feature(p_academy uuid, p_key text) returns boolean language sql stable as $$
  select coalesce((select (features ->> p_key)::boolean from public.academies where id = p_academy),
                  case p_key when 'group' then true else false end) $$;
